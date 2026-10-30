import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import type { LoginResponse, SignupResponse } from '@meanstack/shared';
import { User, UserDocument } from './user.schema';

const TOKEN_TTL_SECONDS = 3600;

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly jwt: JwtService
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

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.users.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Auth failed!');
    }
    const token = await this.jwt.signAsync({ email: user.email, userId: user.id });
    return { token, expiresIn: TOKEN_TTL_SECONDS, userId: user.id };
  }
}
