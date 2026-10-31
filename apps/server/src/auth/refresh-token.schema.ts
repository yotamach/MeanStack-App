import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** A server-side record of one issued refresh token. Only a hash of the token is stored. */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash: string;

  /** All tokens descending from one login share a family, so a stolen chain can be revoked at once. */
  @Prop({ required: true, index: true })
  familyId: string;

  @Prop({ required: true })
  expiresAt: Date;

  /** Set when the token was exchanged for a new one; presenting it again later signals theft. */
  @Prop()
  replacedAt?: Date;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
// MongoDB deletes expired records by itself.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
