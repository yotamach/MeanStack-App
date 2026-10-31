import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { LoginResponse, SignupResponse } from '@meanstack/shared';
import { AuthService, Session } from './auth.service';
import { CredentialsDto } from './dto/credentials.dto';

export const REFRESH_COOKIE = 'refresh_token';

/** The cookie is only sent to the auth endpoints, never with ordinary API calls or image requests. */
const cookieOptions = (req: Request): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: req.secure,
  path: '/api/user',
});

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
  async login(
    @Body() dto: CredentialsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.startSession(await this.auth.login(dto.email, dto.password), req, res);
  }

  /** Called by the client on page load and shortly before the access token expires. */
  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.startSession(await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]), req, res);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieOptions(req));
    return { message: 'Logged out!' };
  }

  private startSession({ response, refresh }: Session, req: Request, res: Response): LoginResponse {
    res.cookie(REFRESH_COOKIE, refresh.token, {
      ...cookieOptions(req),
      expires: refresh.expiresAt,
    });
    return response;
  }
}
