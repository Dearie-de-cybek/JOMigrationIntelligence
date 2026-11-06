import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assess, deriveQuestions, type Answers } from '@jo/assessment-engine';
import type { OverrideResultInput, ProfileInput, SaveAnswersInput, StartAssessmentInput } from '@jo/schemas';
import { PrismaService } from '../prisma/prisma.service';
import { RuleSetsService } from '../rulesets/rulesets.service';
import { generateLeadReference, generateResumeToken, hashToken } from './assessment-token.util';

export const DISCLAIMERS = [
  'This is a preliminary readiness indication only. It is not an immigration decision, a formal eligibility determination, or professional immigration advice.',
  'A points estimate is not an invitation to apply and does not guarantee visa approval.',
  'Official requirements change. Always confirm against the relevant government source and speak to an appropriately authorised migration professional before acting.',
];

const CLOSED_LEAD_STATUSES = ['CONVERTED', 'NOT_PROCEEDING', 'ARCHIVED'] as const;

@Injectable()
export class AssessmentsService {
  constructor(
    private prisma: PrismaService,
    private ruleSets: RuleSetsService,
  ) {}

  async start(input: StartAssessmentInput, ip?: string) {
    const pathway = await this.prisma.migrationPathway.findFirst({ where: { id: input.pathwayId, isActive: true } });
    if (!pathway) throw new NotFoundException('Pathway not found');

    const { token, hash } = generateResumeToken();

    const assessment = await this.prisma.$transaction(async (tx) => {
      // Only reuse an anonymous profile; never attach to an account-linked one.
      const existing = await tx.applicantProfile.findFirst({ where: { email: input.email, userId: null } });
      const profile = existing
        ? await tx.applicantProfile.update({
            where: { id: existing.id },
            data: { fullName: input.fullName, phone: input.phone ?? existing.phone },
          })
        : await tx.applicantProfile.create({
            data: { fullName: input.fullName, email: input.email, phone: input.phone },
          });

      await tx.consentRecord.createMany({
        data: [
          { profileId: profile.id, purpose: 'assessment_processing', granted: true, noticeVersion: input.noticeVersion, ipAddress: ip },
          { profileId: profile.id, purpose: 'marketing_contact', granted: input.consentMarketing, noticeVersion: input.noticeVersion, ipAddress: ip },
        ],
      });

      return tx.migrationAssessment.create({
        data: { profileId: profile.id, pathwayId: pathway.id, resumeTokenHash: hash },
      });
    });

    // The raw token is returned exactly once and never stored or logged.
    return { assessmentId: assessment.id, resumeToken: token };
  }

  private async authorize(token: string | undefined, id?: string) {
    if (!token) throw new NotFoundException('Assessment not found');
    const assessment = await this.prisma.migrationAssessment.findUnique({
      where: { resumeTokenHash: hashToken(token) },
      include: { pathway: { select: { id: true, code: true, name: true, destination: true } } },
    });
    if (!assessment || (id && assessment.id !== id)) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  async resume(token: string | undefined) {
    const a = await this.authorize(token);
    return {
      id: a.id,
      status: a.status,
      pathway: a.pathway,
      answers: a.answers,
      submittedAt: a.submittedAt,
    };
  }

  async saveAnswers(id: string, token: string | undefined, input: SaveAnswersInput) {
    const a = await this.authorize(token, id);
    if (a.status !== 'IN_PROGRESS') throw new BadRequestException('This assessment has already been submitted.');
    const merged = { ...(a.answers as Record<string, unknown>), ...input.answers };
    await this.prisma.migrationAssessment.update({
      where: { id },
      data: { answers: merged as Prisma.InputJsonValue },
    });
    return { id, savedKeys: Object.keys(input.answers).length };
  }

  /** Pathway questions come from the active rule set; empty means rules are not configured yet. */
  async questions(id: string, token: string | undefined) {
    const a = await this.authorize(token, id);
    const active = await this.ruleSets.findActive(a.pathwayId);
    return { configured: !!active, questions: deriveQuestions(active?.config ?? null) };
  }

  /** Replaces whichever structured sections are supplied; omitted sections are untouched. */
  async saveProfile(id: string, token: string | undefined, input: ProfileInput) {
    const a = await this.authorize(token, id);
    if (a.status !== 'IN_PROGRESS') throw new BadRequestException('This assessment has already been submitted.');
    const pid = a.profileId;

    await this.prisma.$transaction(async (tx) => {
      if (input.personal) {
        await tx.applicantProfile.update({ where: { id: pid }, data: input.personal });
      }
      if (input.education) {
        await tx.educationHistory.deleteMany({ where: { profileId: pid } });
        await tx.educationHistory.createMany({ data: input.education.map((e) => ({ ...e, profileId: pid })) });
      }
      if (input.employment) {
        await tx.employmentHistory.deleteMany({ where: { profileId: pid } });
        await tx.employmentHistory.createMany({ data: input.employment.map((e) => ({ ...e, profileId: pid })) });
      }
      if (input.languageTests) {
        await tx.languageTest.deleteMany({ where: { profileId: pid } });
        await tx.languageTest.createMany({ data: input.languageTests.map((t) => ({ ...t, profileId: pid })) });
      }
    });
    return { id, saved: Object.keys(input) };
  }

  async getProfile(id: string, token: string | undefined) {
    const a = await this.authorize(token, id);
    const p = await this.prisma.applicantProfile.findUnique({
      where: { id: a.profileId },
      include: { education: true, employment: true, languageTests: true },
    });
    if (!p) throw new NotFoundException('Profile not found');
    const { id: _id, userId: _u, createdAt: _c, updatedAt: _up, ...rest } = p;
    return rest;
  }

  async submit(id: string, token: string | undefined) {
    const a = await this.authorize(token, id);
    if (a.status !== 'IN_PROGRESS') throw new BadRequestException('This assessment has already been submitted.');

    // Only a PUBLISHED, in-effect rule set may drive a result; otherwise NOT_YET_ASSESSED.
    const active = await this.ruleSets.findActive(a.pathwayId);
    const output = assess(active?.config ?? null, a.answers as Answers);

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.assessmentResult.create({
        data: {
          assessmentId: a.id,
          ruleSetId: active?.id ?? null,
          status: output.status,
          totalPoints: output.totalPoints,
          output: output as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.migrationAssessment.update({
        where: { id: a.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });

      // One open lead per applicant: update it rather than creating a duplicate.
      const openLead = await tx.lead.findFirst({
        where: { profileId: a.profileId, deletedAt: null, status: { notIn: [...CLOSED_LEAD_STATUSES] } },
        orderBy: { createdAt: 'desc' },
      });
      if (openLead) {
        await tx.lead.update({
          where: { id: openLead.id },
          data: {
            assessmentId: a.id,
            destination: a.pathway.destination,
            status: openLead.status === 'NEW_ENQUIRY' ? 'ASSESSMENT_COMPLETED' : openLead.status,
          },
        });
      } else {
        await tx.lead.create({
          data: {
            reference: generateLeadReference(),
            profileId: a.profileId,
            assessmentId: a.id,
            destination: a.pathway.destination,
            status: 'ASSESSMENT_COMPLETED',
          },
        });
      }
      return created;
    });

    return this.toView(result, a.pathway);
  }

  async getResult(id: string, token: string | undefined) {
    const a = await this.authorize(token, id);
    const result = await this.prisma.assessmentResult.findFirst({
      where: { assessmentId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (!result) throw new NotFoundException('No result yet. Submit the assessment first.');
    return this.toView(result, a.pathway);
  }

  /** Human review: recorded beside the engine output, never replacing it. */
  async override(resultId: string, reviewerId: string, input: OverrideResultInput) {
    const result = await this.prisma.assessmentResult.findUnique({ where: { id: resultId } });
    if (!result) throw new NotFoundException('Result not found');
    return this.prisma.assessmentResult.update({
      where: { id: resultId },
      data: { overrideStatus: input.status, overrideReason: input.reason, reviewedById: reviewerId, reviewedAt: new Date() },
      select: { id: true, status: true, overrideStatus: true, overrideReason: true, reviewedAt: true },
    });
  }

  private toView(
    r: { id: string; status: string; overrideStatus: string | null; totalPoints: number | null; output: Prisma.JsonValue; createdAt: Date },
    pathway: { code: string; name: string; destination: string },
  ) {
    const out = r.output as { ruleSetVersion?: string | null } | null;
    return {
      id: r.id,
      pathway,
      status: r.overrideStatus ?? r.status,
      engineStatus: r.status,
      reviewedByStaff: r.overrideStatus !== null,
      totalPoints: r.totalPoints,
      ruleSetVersion: out?.ruleSetVersion ?? null,
      generatedAt: r.createdAt,
      details: r.output,
      disclaimers: DISCLAIMERS,
    };
  }
}
