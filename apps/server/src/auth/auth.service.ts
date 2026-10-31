import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import type { LoginResponse, SignupResponse } from '@meanstack/shared';
import { IssuedRefreshToken, RefreshTokenService } from './refresh-token.service';
import { User, UserDocument } from './user.schema';

/** Access tokens are short-lived; the refresh token cookie is what keeps a user signed in. */
export const ACCESS_TOKEN_TTL_SECONDS = 900;

export interface Session {
  response: LoginResponse;
  refresh: IssuedRefreshToken;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly jwt: JwtService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async signup(email: string, password: string): Promise<SignupResponse> {
    const hash = await bcrypt.hash(password, 10);
    try {
      const user = await this.users.create({ email, password: hash });
      return { message: 'User created!', result: { id: user.id, email: user.email } };
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new BadRequestException('Invalid or already used email!');
      }
      throw err;
    }
  }

  async login(email: string, password: string): Promise<Session> {
    const user = await this.users.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Auth failed!');
    }
    return {
      response: await this.accessToken(user),
      refresh: await this.refreshTokens.issue(user.id),
    };
  }

  /** Trades the refresh token for a new access token and a rotated refresh token. */
  async refresh(presented: string | undefined): Promise<Session> {
    const { userId, ...refresh } = await this.refreshTokens.rotate(presented);
    const user = await this.users.findById(userId);
    if (!user) {
      await this.refreshTokens.revoke(refresh.token);
      throw new UnauthorizedException('Session expired!');
    }
    return { response: await this.accessToken(user), refresh };
  }

  logout(presented: string | undefined): Promise<void> {
    return this.refreshTokens.revoke(presented);
  }

  private async accessToken(user: UserDocument): Promise<LoginResponse> {
    const token = await this.jwt.signAsync({ email: user.email, userId: user.id });
    return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS, userId: user.id };
  }
}
