import type {
  Answers,
  AnswerValue,
  AssessmentOutput,
  Factor,
  FactorResult,
  Requirement,
  RequirementResult,
  RuleSetConfig,
} from './types';

const isMissing = (v: AnswerValue): boolean => v === undefined || v === null || v === '';

function evalFactor(factor: Factor, answers: Answers): FactorResult {
  const raw = answers[factor.answerKey];
  if (isMissing(raw)) {
    return { factorId: factor.id, label: factor.label, points: null, reason: `No answer for "${factor.answerKey}".` };
  }

  if (factor.kind === 'category_map') {
    const key = String(raw);
    if (!(key in factor.map)) {
      return { factorId: factor.id, label: factor.label, points: null, reason: `No points configured for "${key}".` };
    }
    return { factorId: factor.id, label: factor.label, points: factor.map[key], reason: `"${key}" scores ${factor.map[key]}.` };
  }

  const n = Number(raw);
  if (Number.isNaN(n)) {
    return { factorId: factor.id, label: factor.label, points: null, reason: `"${String(raw)}" is not a number.` };
  }
  const band = factor.bands.find((b) => (b.min === undefined || n >= b.min) && (b.max === undefined || n <= b.max));
  if (!band) {
    return { factorId: factor.id, label: factor.label, points: null, reason: `No band configured covering ${n}.` };
  }
  return { factorId: factor.id, label: factor.label, points: band.points, reason: `${n} falls in a band worth ${band.points}.` };
}

function evalRequirement(req: Requirement, answers: Answers): RequirementResult {
  const base = {
    requirementId: req.id,
    label: req.label,
    blocking: req.blocking ?? false,
    documents: req.documents ?? [],
  };
  const raw = answers[req.answerKey];
  if (isMissing(raw)) return { ...base, state: 'UNKNOWN' };

  let met: boolean;
  switch (req.op) {
    case 'truthy':
      met = raw === true || raw === 'true' || raw === 'yes';
      break;
    case 'eq':
      met = raw === req.value;
      break;
    case 'neq':
      met = raw !== req.value;
      break;
    case 'in':
      met = Array.isArray(req.value) && req.value.includes(raw);
      break;
    case 'gte':
      met = Number(raw) >= Number(req.value);
      break;
    case 'lte':
      met = Number(raw) <= Number(req.value);
      break;
  }
  return { ...base, state: met ? 'MET' : 'NOT_MET' };
}

const empty = (ruleSet: RuleSetConfig | null): Omit<AssessmentOutput, 'status' | 'explanation'> => ({
  ruleSetVersion: ruleSet?.version ?? null,
  pathwayCode: ruleSet?.pathwayCode ?? null,
  totalPoints: null,
  passMark: null,
  breakdown: [],
  requirements: [],
  missingInformation: [],
});

/**
 * Evaluate answers against a PUBLISHED rule set. Pure and deterministic.
 * Never invents a result: no configured rules => NOT_YET_ASSESSED.
 * Output is a preliminary readiness indication, not an immigration decision.
 */
export function assess(ruleSet: RuleSetConfig | null, answers: Answers): AssessmentOutput {
  const hasRules =
    !!ruleSet && ((ruleSet.pointsTest?.factors.length ?? 0) > 0 || ruleSet.requirements.length > 0);
  if (!ruleSet || !hasRules) {
    return {
      ...empty(ruleSet),
      status: 'NOT_YET_ASSESSED',
      explanation: ['No published, configured rules exist for this pathway yet, so no result is given.'],
    };
  }

  const explanation: string[] = [];
  const missingRequired = ruleSet.requiredAnswers.filter((k) => isMissing(answers[k]));
  if (missingRequired.length > 0) {
    return {
      ...empty(ruleSet),
      status: 'PROFILE_INCOMPLETE',
      missingInformation: missingRequired,
      explanation: [`Required information is missing: ${missingRequired.join(', ')}.`],
    };
  }

  const factors = ruleSet.pointsTest?.factors ?? [];
  const breakdown = factors.map((f) => evalFactor(f, answers));
  const uncomputed = breakdown.filter((b) => b.points === null);
  const totalPoints = factors.length > 0 ? breakdown.reduce((s, b) => s + (b.points ?? 0), 0) : null;
  const passMark = ruleSet.pointsTest?.passMark ?? null;

  const requirements = ruleSet.requirements.map((r) => evalRequirement(r, answers));
  const unknownReqs = requirements.filter((r) => r.state === 'UNKNOWN');
  const failedBlocking = requirements.filter((r) => r.state === 'NOT_MET' && r.blocking);
  const failedOther = requirements.filter((r) => r.state === 'NOT_MET' && !r.blocking);

  const missingInformation = [
    ...uncomputed.map((b) => b.factorId),
    ...unknownReqs.map((r) => r.requirementId),
  ];

  if (totalPoints !== null) {
    explanation.push(`Points total ${totalPoints}${passMark !== null ? ` against configured pass mark ${passMark}` : ' (no pass mark configured)'}.`);
  }
  if (uncomputed.length) explanation.push(`${uncomputed.length} factor(s) could not be scored.`);
  if (unknownReqs.length) explanation.push(`${unknownReqs.length} requirement(s) could not be checked.`);

  const base = {
    ruleSetVersion: ruleSet.version,
    pathwayCode: ruleSet.pathwayCode,
    totalPoints,
    passMark,
    breakdown,
    requirements,
    missingInformation,
  };

  // A blocking failure is a firm mismatch even if other items are unknown.
  if (failedBlocking.length > 0) {
    explanation.push(`Blocking requirement(s) not met: ${failedBlocking.map((r) => r.label).join('; ')}.`);
    return { ...base, status: 'NOT_MATCHING', explanation };
  }

  // Below pass mark only counts when every factor was scored (partial totals prove nothing).
  if (passMark !== null && totalPoints !== null && uncomputed.length === 0 && totalPoints < passMark) {
    explanation.push('Points are below the configured pass mark.');
    return { ...base, status: 'NOT_MATCHING', explanation };
  }

  if (uncomputed.length > 0 || unknownReqs.length > 0) {
    return { ...base, status: 'REQUIRES_REVIEW', explanation };
  }

  if (failedOther.length > 0) {
    explanation.push(`Additional requirement(s) identified: ${failedOther.map((r) => r.label).join('; ')}.`);
    return { ...base, status: 'ADDITIONAL_REQUIREMENTS', explanation };
  }

  explanation.push('All configured checks passed. This is a preliminary indication only.');
  return { ...base, status: 'POTENTIALLY_SUITABLE', explanation };
}
