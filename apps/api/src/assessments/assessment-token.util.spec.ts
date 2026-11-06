import { generateLeadReference, generateResumeToken, hashToken } from './assessment-token.util';

describe('assessment token util', () => {
  it('hash matches token and tokens are unique', () => {
    const a = generateResumeToken();
    const b = generateResumeToken();
    expect(hashToken(a.token)).toBe(a.hash);
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(a.token);
  });

  it('lead reference has expected format', () => {
    expect(generateLeadReference()).toMatch(/^JO-L-[A-HJ-NP-Z2-9]{8}$/);
  });
});
