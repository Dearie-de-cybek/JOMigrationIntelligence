import { z } from 'zod';

/**
 * Fixed role enum for MVP (see Phase 0 plan, section 2 and 3).
 * A separate Permission table is reserved in the data model for later
 * fine-grained, admin-editable permissions but is not wired up yet.
 */
export const ROLES = [
  'SUPER_ADMIN',
  'ADMINISTRATOR',
  'CONSULTANT',
  'OPERATIONS_STAFF',
  'APPLICANT',
] as const;

export const roleSchema = z.enum(ROLES);

export type Role = z.infer<typeof roleSchema>;

/** Roles that may sign in to the internal operations app. */
export const INTERNAL_ROLES: Role[] = ['SUPER_ADMIN', 'ADMINISTRATOR', 'CONSULTANT', 'OPERATIONS_STAFF'];
