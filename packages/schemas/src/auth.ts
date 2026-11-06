import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address');

// Argon2id hashes the password server-side; this only guards against obviously weak input.
const password = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a number');

/** Public self-registration. Always creates an APPLICANT — role is never client-supplied. */
export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email,
  password,
  phone: z.string().trim().min(5).max(30).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
