import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { LoginResponse, SignupResponse } from '@meanstack/shared';
import { AuthService } from './auth.service';
import { CredentialsDto } from './dto/credentials.dto';

@Controller('user')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(@Body() dto: CredentialsDto): Promise<SignupResponse> {
    return this.auth.signup(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: CredentialsDto): Promise<LoginResponse> {
    return this.auth.login(dto.email, dto.password);
  }
}
