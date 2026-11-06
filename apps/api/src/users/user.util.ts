import type { User } from '@prisma/client';

export type PublicUser = Omit<User, 'passwordHash' | 'deletedAt'>;

/** Strips passwordHash (and internal-only fields) before a User ever leaves the API. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, deletedAt: _deletedAt, ...publicUser } = user;
  return publicUser;
}
