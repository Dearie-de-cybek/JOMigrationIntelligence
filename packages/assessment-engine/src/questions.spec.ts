import { deriveQuestions } from './questions';
import type { RuleSetConfig } from './types';

// TEST FIXTURE ONLY - arbitrary values.
const cfg: RuleSetConfig = {
  pathwayCode: 'T',
  version: '1',
  requiredAnswers: ['age'],
  pointsTest: {
    factors: [
      { id: 'edu', label: 'Education', kind: 'category_map', answerKey: 'edu', map: { degree: 1, diploma: 2 } },
      { id: 'age', label: 'Age', kind: 'numeric_bands', answerKey: 'age', bands: [{ points: 1 }] },
    ],
  },
  requirements: [
    { id: 'r1', label: 'Has test', answerKey: 'hasTest', op: 'truthy' },
    { id: 'r2', label: 'Country', answerKey: 'country', op: 'in', value: ['A', 'B'] },
  ],
};

describe('deriveQuestions', () => {
  it('returns nothing without a rule set', () => {
    expect(deriveQuestions(null)).toEqual([]);
  });

  it('derives typed questions, required first', () => {
    const q = deriveQuestions(cfg);
    expect(q[0]).toMatchObject({ key: 'age', input: 'number', required: true });
    expect(q.find((x) => x.key === 'edu')).toMatchObject({ input: 'select', options: ['degree', 'diploma'] });
    expect(q.find((x) => x.key === 'hasTest')?.input).toBe('boolean');
    expect(q.find((x) => x.key === 'country')?.options).toEqual(['A', 'B']);
  });
});
