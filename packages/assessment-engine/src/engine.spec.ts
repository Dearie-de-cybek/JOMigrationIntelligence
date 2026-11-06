import { assess } from './engine';
import type { RuleSetConfig } from './types';

// TEST FIXTURE ONLY. These numbers are arbitrary and do NOT reflect any
// government's rules. Real rule sets are authored, sourced and approved in the app.
const fixture: RuleSetConfig = {
  pathwayCode: 'TEST-PATH',
  version: 'test-1',
  requiredAnswers: ['age'],
  pointsTest: {
    passMark: 10,
    factors: [
      { id: 'age', label: 'Age', kind: 'numeric_bands', answerKey: 'age', bands: [{ max: 30, points: 10 }, { min: 31, max: 40, points: 5 }] },
      { id: 'edu', label: 'Education', kind: 'category_map', answerKey: 'edu', map: { degree: 5, diploma: 2 } },
    ],
  },
  requirements: [
    { id: 'lang', label: 'Language test', answerKey: 'langOk', op: 'truthy', blocking: true },
    { id: 'skills', label: 'Skills assessment', answerKey: 'skillsOk', op: 'truthy', documents: ['Skills assessment outcome'] },
  ],
};

describe('assess', () => {
  it('returns NOT_YET_ASSESSED with no rule set', () => {
    expect(assess(null, { age: 25 }).status).toBe('NOT_YET_ASSESSED');
  });

  it('returns NOT_YET_ASSESSED when rule set is empty', () => {
    const r = assess({ pathwayCode: 'X', version: '1', requiredAnswers: [], requirements: [] }, {});
    expect(r.status).toBe('NOT_YET_ASSESSED');
  });

  it('flags PROFILE_INCOMPLETE when required answers missing', () => {
    const r = assess(fixture, {});
    expect(r.status).toBe('PROFILE_INCOMPLETE');
    expect(r.missingInformation).toEqual(['age']);
  });

  it('is POTENTIALLY_SUITABLE when everything passes', () => {
    const r = assess(fixture, { age: 25, edu: 'degree', langOk: true, skillsOk: true });
    expect(r.status).toBe('POTENTIALLY_SUITABLE');
    expect(r.totalPoints).toBe(15);
    expect(r.ruleSetVersion).toBe('test-1');
  });

  it('is NOT_MATCHING on blocking requirement failure', () => {
    const r = assess(fixture, { age: 25, edu: 'degree', langOk: false, skillsOk: true });
    expect(r.status).toBe('NOT_MATCHING');
  });

  it('is NOT_MATCHING below pass mark when all factors scored', () => {
    const r = assess(fixture, { age: 35, edu: 'diploma', langOk: true, skillsOk: true });
    expect(r.totalPoints).toBe(7);
    expect(r.status).toBe('NOT_MATCHING');
  });

  it('does not claim below-pass when a factor is unscored', () => {
    const r = assess(fixture, { age: 35, langOk: true, skillsOk: true });
    expect(r.status).toBe('REQUIRES_REVIEW');
    expect(r.missingInformation).toContain('edu');
  });

  it('is ADDITIONAL_REQUIREMENTS for non-blocking failure', () => {
    const r = assess(fixture, { age: 25, edu: 'degree', langOk: true, skillsOk: false });
    expect(r.status).toBe('ADDITIONAL_REQUIREMENTS');
    expect(r.requirements.find((x) => x.requirementId === 'skills')?.documents).toEqual(['Skills assessment outcome']);
  });

  it('treats an age with no configured band as unscored, not zero', () => {
    const r = assess(fixture, { age: 60, edu: 'degree', langOk: true, skillsOk: true });
    expect(r.breakdown[0].points).toBeNull();
    expect(r.status).toBe('REQUIRES_REVIEW');
  });

  it('reports unknown requirements as REQUIRES_REVIEW', () => {
    const r = assess(fixture, { age: 25, edu: 'degree' });
    expect(r.status).toBe('REQUIRES_REVIEW');
  });
});
