import { z } from 'zod';
import { roleSchema } from './role';

/** Shape returned to clients - never includes passwordHash or token fields. */
export const userSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  role: roleSchema,
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

/** Super Admin / Administrator creating a staff account. */
export const createStaffUserSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(5).max(30).optional(),
  role: z.enum(['ADMINISTRATOR', 'CONSULTANT', 'OPERATIONS_STAFF']),
});
export type CreateStaffUserInput = z.infer<typeof createStaffUserSchema>;
