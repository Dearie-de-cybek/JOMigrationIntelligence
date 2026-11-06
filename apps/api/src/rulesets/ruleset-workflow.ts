import { BadRequestException, ForbiddenException } from '@nestjs/common';

export type RuleSetStatusName = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'RETIRED';

const ALLOWED: Record<RuleSetStatusName, RuleSetStatusName[]> = {
  DRAFT: ['IN_REVIEW'],
  IN_REVIEW: ['DRAFT', 'PUBLISHED'], // reject returns to DRAFT
  PUBLISHED: ['RETIRED'],
  RETIRED: [],
};

export function assertTransition(from: RuleSetStatusName, to: RuleSetStatusName): void {
  if (!ALLOWED[from].includes(to)) {
    throw new BadRequestException(`Cannot move a rule set from ${from} to ${to}.`);
  }
}

/** Four-eyes rule: the person who authored a rule set may not approve it. */
export function assertDistinctApprover(authorId: string, approverId: string): void {
  if (authorId === approverId) {
    throw new ForbiddenException('A rule set must be approved by someone other than its author.');
  }
}

/** Publication needs an official source and a review date on record. */
export function assertPublishable(rs: { sourceUrl: string; lastReviewedAt: Date | null }): void {
  if (!rs.sourceUrl) throw new BadRequestException('A source URL is required before publishing.');
  if (!rs.lastReviewedAt) throw new BadRequestException('A last-reviewed date is required before publishing.');
}
