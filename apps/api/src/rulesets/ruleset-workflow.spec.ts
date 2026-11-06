import { assertDistinctApprover, assertPublishable, assertTransition } from './ruleset-workflow';

describe('ruleset workflow', () => {
  it('allows DRAFT -> IN_REVIEW -> PUBLISHED -> RETIRED', () => {
    expect(() => assertTransition('DRAFT', 'IN_REVIEW')).not.toThrow();
    expect(() => assertTransition('IN_REVIEW', 'PUBLISHED')).not.toThrow();
    expect(() => assertTransition('PUBLISHED', 'RETIRED')).not.toThrow();
  });

  it('allows rejection back to DRAFT', () => {
    expect(() => assertTransition('IN_REVIEW', 'DRAFT')).not.toThrow();
  });

  it('blocks skipping review', () => {
    expect(() => assertTransition('DRAFT', 'PUBLISHED')).toThrow();
  });

  it('blocks editing history', () => {
    expect(() => assertTransition('PUBLISHED', 'DRAFT')).toThrow();
    expect(() => assertTransition('RETIRED', 'PUBLISHED')).toThrow();
  });

  it('rejects self-approval', () => {
    expect(() => assertDistinctApprover('a', 'a')).toThrow();
    expect(() => assertDistinctApprover('a', 'b')).not.toThrow();
  });

  it('requires source and review date to publish', () => {
    expect(() => assertPublishable({ sourceUrl: 'https://x.gov', lastReviewedAt: null })).toThrow();
    expect(() => assertPublishable({ sourceUrl: '', lastReviewedAt: new Date() })).toThrow();
    expect(() => assertPublishable({ sourceUrl: 'https://x.gov', lastReviewedAt: new Date() })).not.toThrow();
  });
});
