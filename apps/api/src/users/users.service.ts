import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import type { CreateStaffUserInput } from '@jo/schemas';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin-created staff accounts get a random temporary password (never
   * emailed here - no email provider is wired up yet per Phase 0 risk
   * notes). Returns it once so the admin can share it out-of-band; it is
   * never stored or logged in plaintext.
   */
  async createStaffUser(input: CreateStaffUserInput) {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const temporaryPassword = randomBytes(12).toString('base64url');
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        role: input.role,
        passwordHash,
      },
    });

    return { user, temporaryPassword };
  }

  async list() {
    return this.prisma.user.findMany({ where: { deletedAt: null }, orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string) {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }
}
