import { z } from 'zod';

/**
 * Validation for rule-set config JSON (mirrors RuleSetConfig in
 * @jo/assessment-engine). Shape only: it never supplies any figure itself.
 */
const sourceRef = z.object({
  url: z.string().url(),
  label: z.string().max(200).optional(),
  lastReviewed: z.string().optional(),
});

const answerValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const band = z
  .object({ min: z.number().optional(), max: z.number().optional(), points: z.number() })
  .refine((b) => b.min === undefined || b.max === undefined || b.min <= b.max, 'band min must be <= max');

const factor = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.literal('numeric_bands'),
    answerKey: z.string().min(1),
    bands: z.array(band).min(1),
    source: sourceRef.optional(),
  }),
  z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    kind: z.literal('category_map'),
    answerKey: z.string().min(1),
    map: z.record(z.number()),
    source: sourceRef.optional(),
  }),
]);

const requirement = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  answerKey: z.string().min(1),
  op: z.enum(['eq', 'neq', 'gte', 'lte', 'in', 'truthy']),
  value: z.union([answerValue, z.array(answerValue)]).optional(),
  blocking: z.boolean().optional(),
  documents: z.array(z.string()).optional(),
  source: sourceRef.optional(),
});

export const ruleSetConfigSchema = z
  .object({
    pathwayCode: z.string().min(1),
    version: z.string().min(1),
    pointsTest: z.object({ passMark: z.number().optional(), factors: z.array(factor) }).optional(),
    requirements: z.array(requirement),
    requiredAnswers: z.array(z.string()),
  })
  .superRefine((cfg, ctx) => {
    const ids = [...(cfg.pointsTest?.factors ?? []), ...cfg.requirements].map((x) => x.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'factor and requirement ids must be unique' });
    }
    for (const r of cfg.requirements) {
      if (r.op !== 'truthy' && r.value === undefined) {
        ctx.addIssue({ code: 'custom', message: `requirement "${r.id}" needs a value for op "${r.op}"` });
      }
    }
  });
export type RuleSetConfigInput = z.infer<typeof ruleSetConfigSchema>;

export const createRuleSetSchema = z.object({
  pathwayId: z.string().uuid(),
  version: z.string().trim().min(1).max(50),
  config: ruleSetConfigSchema,
  /** Official source (Home Affairs / IRCC / Immigration NZ etc). Mandatory. */
  sourceUrl: z.string().url(),
  lastReviewedAt: z.coerce.date().optional(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional(),
});
export type CreateRuleSetInput = z.infer<typeof createRuleSetSchema>;

export const updateRuleSetSchema = createRuleSetSchema.omit({ pathwayId: true }).partial();
export type UpdateRuleSetInput = z.infer<typeof updateRuleSetSchema>;

export const createPathwaySchema = z.object({
  code: z.string().trim().min(2).max(40),
  destination: z.enum(['AUSTRALIA', 'NEW_ZEALAND', 'CANADA']),
  name: z.string().trim().min(2).max(200),
});
export type CreatePathwayInput = z.infer<typeof createPathwaySchema>;
