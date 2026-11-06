import { createHash, randomBytes, randomInt } from 'crypto';

/** Raw token is shown to the applicant once; only its SHA-256 is stored. */
export function generateResumeToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// No 0/O/1/I to keep references easy to read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateLeadReference(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `JO-L-${s}`;
}
