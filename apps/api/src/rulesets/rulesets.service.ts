import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RuleSetConfig } from '@jo/assessment-engine';
import type { CreateRuleSetInput, UpdateRuleSetInput } from '@jo/schemas';
import { PrismaService } from '../prisma/prisma.service';
import { assertDistinctApprover, assertPublishable, assertTransition } from './ruleset-workflow';

@Injectable()
export class RuleSetsService {
  constructor(private prisma: PrismaService) {}

  list(pathwayId?: string) {
    return this.prisma.assessmentRuleSet.findMany({
      where: pathwayId ? { pathwayId } : undefined,
      orderBy: [{ pathwayId: 'asc' }, { effectiveFrom: 'desc' }],
      include: { pathway: { select: { code: true, name: true } } },
    });
  }

  async get(id: string) {
    const rs = await this.prisma.assessmentRuleSet.findUnique({ where: { id }, include: { pathway: true } });
    if (!rs) throw new NotFoundException('Rule set not found');
    return rs;
  }

  private async assertConfigMatchesPathway(pathwayId: string, version: string, config: { pathwayCode: string; version: string }) {
    const pathway = await this.prisma.migrationPathway.findUnique({ where: { id: pathwayId } });
    if (!pathway) throw new NotFoundException('Pathway not found');
    if (config.pathwayCode !== pathway.code) {
      throw new BadRequestException(`config.pathwayCode "${config.pathwayCode}" does not match pathway "${pathway.code}".`);
    }
    if (config.version !== version) {
      throw new BadRequestException('config.version must equal the rule set version.');
    }
  }

  async createDraft(input: CreateRuleSetInput, authorId: string) {
    await this.assertConfigMatchesPathway(input.pathwayId, input.version, input.config);
    try {
      return await this.prisma.assessmentRuleSet.create({
        data: {
          pathwayId: input.pathwayId,
          version: input.version,
          config: input.config as Prisma.InputJsonValue,
          sourceUrl: input.sourceUrl,
          lastReviewedAt: input.lastReviewedAt,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          authoredById: authorId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('That version already exists for this pathway.');
      }
      throw e;
    }
  }

  async updateDraft(id: string, input: UpdateRuleSetInput) {
    const rs = await this.get(id);
    if (rs.status !== 'DRAFT') throw new BadRequestException('Only DRAFT rule sets can be edited. Create a new version instead.');
    const version = input.version ?? rs.version;
    const config = input.config ?? (rs.config as unknown as { pathwayCode: string; version: string });
    await this.assertConfigMatchesPathway(rs.pathwayId, version, config);
    return this.prisma.assessmentRuleSet.update({
      where: { id },
      data: {
        version: input.version,
        config: input.config as Prisma.InputJsonValue | undefined,
        sourceUrl: input.sourceUrl,
        lastReviewedAt: input.lastReviewedAt,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
      },
    });
  }

  async submitForReview(id: string) {
    const rs = await this.get(id);
    assertTransition(rs.status, 'IN_REVIEW');
    return this.prisma.assessmentRuleSet.update({ where: { id }, data: { status: 'IN_REVIEW' } });
  }

  async reject(id: string) {
    const rs = await this.get(id);
    assertTransition(rs.status, 'DRAFT');
    return this.prisma.assessmentRuleSet.update({ where: { id }, data: { status: 'DRAFT' } });
  }

  /** Approve + publish atomically; retires the pathway's previous open-ended published set. */
  async approveAndPublish(id: string, approverId: string) {
    const rs = await this.get(id);
    assertTransition(rs.status, 'PUBLISHED');
    assertDistinctApprover(rs.authoredById, approverId);
    assertPublishable(rs);

    return this.prisma.$transaction(async (tx) => {
      await tx.assessmentRuleSet.updateMany({
        where: {
          pathwayId: rs.pathwayId,
          status: 'PUBLISHED',
          id: { not: id },
          effectiveFrom: { lte: rs.effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: rs.effectiveFrom } }],
        },
        data: { status: 'RETIRED', effectiveTo: rs.effectiveFrom },
      });
      return tx.assessmentRuleSet.update({
        where: { id },
        data: { status: 'PUBLISHED', approvedById: approverId, approvedAt: new Date() },
      });
    });
  }

  async retire(id: string) {
    const rs = await this.get(id);
    assertTransition(rs.status, 'RETIRED');
    return this.prisma.assessmentRuleSet.update({
      where: { id },
      data: { status: 'RETIRED', effectiveTo: rs.effectiveTo ?? new Date() },
    });
  }

  /**
   * The only rule set an applicant result may be computed from: PUBLISHED and
   * effective at `at`. Null means "Not yet assessed" upstream.
   */
  async findActive(pathwayId: string, at: Date = new Date()) {
    const rs = await this.prisma.assessmentRuleSet.findFirst({
      where: {
        pathwayId,
        status: 'PUBLISHED',
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return rs ? { id: rs.id, config: rs.config as unknown as RuleSetConfig } : null;
  }
}
