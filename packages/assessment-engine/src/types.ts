/**
 * Rule-set config types. A rule set is DATA (stored as JSON in the database,
 * versioned, reviewed and approved before publication). The engine never
 * contains a visa threshold, points value or occupation list of its own.
 */

export type AnswerValue = string | number | boolean | null | undefined;
export type Answers = Record<string, AnswerValue>;

export interface SourceRef {
  /** Official source, e.g. a Home Affairs / IRCC / Immigration NZ page. */
  url: string;
  label?: string;
  lastReviewed?: string; // ISO date
}

/** One band in a numeric points table. Bounds are inclusive; omit for open-ended. */
export interface NumericBand {
  min?: number;
  max?: number;
  points: number;
}

export type Factor =
  | {
      id: string;
      label: string;
      kind: 'numeric_bands';
      answerKey: string;
      bands: NumericBand[];
      source?: SourceRef;
    }
  | {
      id: string;
      label: string;
      kind: 'category_map';
      answerKey: string;
      map: Record<string, number>;
      source?: SourceRef;
    };

export type RequirementOp = 'eq' | 'neq' | 'gte' | 'lte' | 'in' | 'truthy';

export interface Requirement {
  id: string;
  label: string;
  answerKey: string;
  op: RequirementOp;
  /** Not needed for `truthy`. */
  value?: AnswerValue | AnswerValue[];
  /** If true, failing this makes the outcome NOT_MATCHING rather than ADDITIONAL_REQUIREMENTS. */
  blocking?: boolean;
  /** Documents typically evidencing this requirement (shown in the report). */
  documents?: string[];
  source?: SourceRef;
}

export interface RuleSetConfig {
  pathwayCode: string;
  version: string;
  /** Points-tested pathways only. */
  pointsTest?: {
    /** Pass mark. Omit if the source defines none - then no pass/fail is claimed. */
    passMark?: number;
    factors: Factor[];
  };
  requirements: Requirement[];
  /** Answer keys that must be present before anything can be assessed. */
  requiredAnswers: string[];
}

export type AssessmentStatus =
  | 'NOT_YET_ASSESSED'
  | 'PROFILE_INCOMPLETE'
  | 'REQUIRES_REVIEW'
  | 'POTENTIALLY_SUITABLE'
  | 'ADDITIONAL_REQUIREMENTS'
  | 'NOT_MATCHING';

export interface FactorResult {
  factorId: string;
  label: string;
  points: number | null; // null = could not be computed (missing answer / no matching band)
  reason: string;
}

export type RequirementState = 'MET' | 'NOT_MET' | 'UNKNOWN';

export interface RequirementResult {
  requirementId: string;
  label: string;
  state: RequirementState;
  blocking: boolean;
  documents: string[];
}

export interface AssessmentOutput {
  status: AssessmentStatus;
  ruleSetVersion: string | null;
  pathwayCode: string | null;
  totalPoints: number | null;
  passMark: number | null;
  breakdown: FactorResult[];
  requirements: RequirementResult[];
  missingInformation: string[];
  /** Human-readable trail of how the status was reached. */
  explanation: string[];
}
