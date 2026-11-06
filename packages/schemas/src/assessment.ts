import { z } from 'zod';

export const startAssessmentSchema = z.object({
  pathwayId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(5).max(30).optional(),
  /** Explicit consent to process data for the assessment. Must be true. */
  consentAssessment: z.literal(true),
  consentMarketing: z.boolean().default(false),
  /** Version of the privacy notice shown to the applicant. */
  noticeVersion: z.string().trim().min(1).max(50),
});
export type StartAssessmentInput = z.infer<typeof startAssessmentSchema>;

const answerValue = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);

/** Flexible per-pathway answers, keyed by the rule set's answerKeys. */
export const saveAnswersSchema = z.object({
  answers: z
    .record(z.string().min(1).max(100), answerValue)
    .refine((a) => Object.keys(a).length <= 200, 'too many answers'),
});
export type SaveAnswersInput = z.infer<typeof saveAnswersSchema>;

export const RESULT_STATUSES = [
  'NOT_YET_ASSESSED',
  'PROFILE_INCOMPLETE',
  'REQUIRES_REVIEW',
  'POTENTIALLY_SUITABLE',
  'ADDITIONAL_REQUIREMENTS',
  'NOT_MATCHING',
] as const;

export const overrideResultSchema = z.object({
  status: z.enum(RESULT_STATUSES),
  reason: z.string().trim().min(5).max(2000),
});
export type OverrideResultInput = z.infer<typeof overrideResultSchema>;
