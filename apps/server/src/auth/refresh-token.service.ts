import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Model, Types } from 'mongoose';
import { Env } from '../config/env';
import { RefreshToken, RefreshTokenDocument } from './refresh-token.schema';

/**
 * Two tabs refreshing at the same moment both present the same token. Within this window the second
 * request is treated as that race and gets a fresh token; after it, reuse is treated as theft.
 */
export const REUSE_GRACE_MS = 10_000;

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class RefreshTokenService {
  private readonly ttlMs: number;

  constructor(
    @InjectModel(RefreshToken.name) private readonly tokens: Model<RefreshTokenDocument>,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }) * 24 * 60 * 60 * 1000;
  }

  /** Starts a new family (a fresh login) unless one is given (a rotation). */
  async issue(
    userId: string | Types.ObjectId,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.tokens.create({ userId, tokenHash: hash(token), familyId, expiresAt });
    return { token, expiresAt };
  }

  /** Exchanges a valid refresh token for a new one; every failure is the same 401. */
  async rotate(presented: string | undefined): Promise<IssuedRefreshToken & { userId: string }> {
    const fail = () => new UnauthorizedException('Session expired!');
    if (!presented) {
      throw fail();
    }
    const current = await this.tokens.findOne({ tokenHash: hash(presented) });
    if (!current || current.expiresAt.getTime() <= Date.now()) {
      throw fail();
    }
    if (current.replacedAt) {
      if (Date.now() - current.replacedAt.getTime() > REUSE_GRACE_MS) {
        // An already-rotated token is back: assume it leaked and end the whole session family.
        await this.tokens.deleteMany({ familyId: current.familyId });
        throw fail();
      }
    } else {
      // Only one concurrent request gets to mark it; a loser is the grace-window race described above.
      await this.tokens.updateOne(
        { _id: current._id, replacedAt: { $exists: false } },
        { replacedAt: new Date() },
      );
    }
    const next = await this.issue(current.userId, current.familyId);
    return { ...next, userId: current.userId.toString() };
  }

  /** Ends the session the token belongs to. Unknown or missing tokens are ignored. */
  async revoke(presented: string | undefined): Promise<void> {
    if (!presented) {
      return;
    }
    const current = await this.tokens.findOne({ tokenHash: hash(presented) });
    if (current) {
      await this.tokens.deleteMany({ familyId: current.familyId });
    }
  }
}
