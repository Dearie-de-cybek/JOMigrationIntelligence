import type { RuleSetConfig } from './types';

export interface Question {
  key: string;
  label: string;
  input: 'number' | 'select' | 'boolean' | 'text';
  /** For `select`: the answer values the rule set knows how to score. */
  options?: string[];
  required: boolean;
}

/**
 * Derives the pathway-specific questions from a published rule set, so the
 * wizard only asks what the rules can actually use and nothing is hardcoded
 * in the frontend. Order: required answers first, then the rest in rule order.
 */
export function deriveQuestions(config: RuleSetConfig | null): Question[] {
  if (!config) return [];
  const byKey = new Map<string, Question>();
  const required = new Set(config.requiredAnswers);

  const add = (q: Omit<Question, 'required'>) => {
    const existing = byKey.get(q.key);
    // A categorical/numeric definition is more specific than a plain text one.
    if (!existing || (existing.input === 'text' && q.input !== 'text')) {
      byKey.set(q.key, { ...q, required: required.has(q.key) });
    }
  };

  for (const f of config.pointsTest?.factors ?? []) {
    if (f.kind === 'numeric_bands') add({ key: f.answerKey, label: f.label, input: 'number' });
    else add({ key: f.answerKey, label: f.label, input: 'select', options: Object.keys(f.map) });
  }
  for (const r of config.requirements) {
    if (r.op === 'truthy') add({ key: r.answerKey, label: r.label, input: 'boolean' });
    else if (r.op === 'gte' || r.op === 'lte') add({ key: r.answerKey, label: r.label, input: 'number' });
    else if (r.op === 'in' && Array.isArray(r.value)) {
      add({ key: r.answerKey, label: r.label, input: 'select', options: r.value.map(String) });
    } else add({ key: r.answerKey, label: r.label, input: 'text' });
  }
  for (const key of config.requiredAnswers) {
    if (!byKey.has(key)) byKey.set(key, { key, label: key, input: 'text', required: true });
  }

  const all = [...byKey.values()];
  return [...all.filter((q) => q.required), ...all.filter((q) => !q.required)];
}
