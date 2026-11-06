import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Put, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { overrideResultSchema, profileSchema, saveAnswersSchema, startAssessmentSchema } from '@jo/schemas';
import { AssessmentsService } from './assessments.service';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import { Audit } from '../common/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

/**
 * Applicant routes are public but gated by an unguessable resume token sent in
 * the `x-resume-token` header (never in the URL, so it stays out of logs).
 */
@ApiTags('assessments')
@Controller('assessments')
export class AssessmentsController {
  constructor(private service: AssessmentsService) {}

  // Not audited on purpose: the response contains the raw resume token.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('start')
  start(@Body(new ZodValidationPipe(startAssessmentSchema)) body: never, @Req() req: Request) {
    return this.service.start(body, req.ip);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('resume')
  resume(@Headers('x-resume-token') token?: string) {
    return this.service.resume(token);
  }

  @Public()
  @Patch(':id/answers')
  save(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-resume-token') token: string | undefined,
    @Body(new ZodValidationPipe(saveAnswersSchema)) body: never,
  ) {
    return this.service.saveAnswers(id, token, body);
  }

  @Public()
  @Get(':id/questions')
  questions(@Param('id', ParseUUIDPipe) id: string, @Headers('x-resume-token') token?: string) {
    return this.service.questions(id, token);
  }

  @Public()
  @Get(':id/profile')
  getProfile(@Param('id', ParseUUIDPipe) id: string, @Headers('x-resume-token') token?: string) {
    return this.service.getProfile(id, token);
  }

  @Public()
  @Put(':id/profile')
  saveProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-resume-token') token: string | undefined,
    @Body(new ZodValidationPipe(profileSchema)) body: never,
  ) {
    return this.service.saveProfile(id, token, body);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/submit')
  @Audit('assessment', 'submit')
  submit(@Param('id', ParseUUIDPipe) id: string, @Headers('x-resume-token') token?: string) {
    return this.service.submit(id, token);
  }

  @Public()
  @Get(':id/result')
  result(@Param('id', ParseUUIDPipe) id: string, @Headers('x-resume-token') token?: string) {
    return this.service.getResult(id, token);
  }

  @Patch('results/:resultId/override')
  @Roles('SUPER_ADMIN', 'ADMINISTRATOR', 'CONSULTANT')
  @Audit('assessment_result', 'override')
  override(
    @Param('resultId', ParseUUIDPipe) resultId: string,
    @Body(new ZodValidationPipe(overrideResultSchema)) body: never,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.override(resultId, user.id, body);
  }
}
