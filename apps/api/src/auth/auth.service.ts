import { randomBytes, createHash } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { RegisterInput, LoginInput } from '@jo/schemas';
import { PrismaService } from '../prisma/prisma.service';
import type { AppConfig } from '../config/configuration';
import { parseDurationToMs } from '../common/parse-duration.util';

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  private readonly jwtConfig: AppConfig['jwt'];

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    config: ConfigService,
  ) {
    this.jwtConfig = config.get<AppConfig>('app')!.jwt;
  }

  async register(input: RegisterInput, ip?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        passwordHash,
        role: 'APPLICANT',
      },
    });

    const tokens = await this.issueTokens(user.id, user.email, user.role, ip);
    return { user, tokens };
  }

  async validateCredentials(input: LoginInput) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');
    return user;
  }

  async login(input: LoginInput, ip?: string) {
    const user = await this.validateCredentials(input);
    const tokens = await this.issueTokens(user.id, user.email, user.role, ip);
    return { user, tokens };
  }

  /** Issues a fresh access JWT + a new opaque refresh token, storing only the refresh token's hash. */
  async issueTokens(userId: string, email: string, role: string, ip?: string): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      { secret: this.jwtConfig.accessSecret, expiresIn: this.jwtConfig.accessExpiresIn },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + parseDurationToMs(this.jwtConfig.refreshExpiresIn));
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(refreshToken), expiresAt, createdByIp: ip },
    });

    return { accessToken, expiresIn: parseDurationToMs(this.jwtConfig.accessExpiresIn) / 1000, refreshToken };
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one
   * issued. Presenting an already-revoked token revokes ALL of that user's
   * refresh tokens (reuse detection - the token was likely stolen).
   */
  async refresh(rawToken: string, ip?: string): Promise<IssuedTokens> {
    const tokenHash = sha256(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) throw new UnauthorizedException('Invalid refresh token');

    if (existing.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token already used - all sessions revoked');
    }
    if (existing.expiresAt < new Date()) throw new UnauthorizedException('Refresh token expired');

    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user || user.deletedAt || !user.isActive) throw new UnauthorizedException('Account is no longer active');

    const tokens = await this.issueTokens(user.id, user.email, user.role, ip);
    const newHash = sha256(tokens.refreshToken);
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedBy: newHash },
    });

    return tokens;
  }

  async logout(rawToken: string) {
    const tokenHash = sha256(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  refreshCookieMaxAgeMs(): number {
    return parseDurationToMs(this.jwtConfig.refreshExpiresIn);
  }
}
