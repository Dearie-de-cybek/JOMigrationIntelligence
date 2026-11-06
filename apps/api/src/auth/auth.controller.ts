import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { loginSchema, registerSchema } from '@jo/schemas';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Public } from '../common/public.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { Audit } from '../common/audit.decorator';
import { toPublicUser } from '../users/user.util';
import type { AuthenticatedUser } from './jwt.strategy';
import type { AppConfig } from '../config/configuration';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    const isProd = this.config.get<AppConfig>('app')!.nodeEnv === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: this.authService.refreshCookieMaxAgeMs(),
    });
  }

  @Public()
  @Post('register')
  @Audit('auth', 'register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.register(body as never, req.ip);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { user: toPublicUser(user), accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @Audit('auth', 'login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.login(body as never, req.ip);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { user: toPublicUser(user), accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (!rawToken) throw new UnauthorizedException('No refresh token presented');
    const tokens = await this.authService.refresh(rawToken, req.ip);
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.[REFRESH_COOKIE];
    if (rawToken) await this.authService.logout(rawToken);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { success: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
