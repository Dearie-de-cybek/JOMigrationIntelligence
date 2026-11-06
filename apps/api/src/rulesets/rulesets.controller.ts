import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createRuleSetSchema, updateRuleSetSchema } from '@jo/schemas';
import { RuleSetsService } from './rulesets.service';
import { Roles } from '../common/roles.decorator';
import { Audit } from '../common/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

/** Migration rule management is Super Administrator only (brief, Part 5). */
@ApiTags('rulesets')
@Controller('rulesets')
@Roles('SUPER_ADMIN')
export class RuleSetsController {
  constructor(private service: RuleSetsService) {}

  @Get()
  list(@Query('pathwayId') pathwayId?: string) {
    return this.service.list(pathwayId);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post()
  @Audit('assessment_ruleset', 'create')
  create(@Body(new ZodValidationPipe(createRuleSetSchema)) body: never, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createDraft(body, user.id);
  }

  @Patch(':id')
  @Audit('assessment_ruleset', 'update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateRuleSetSchema)) body: never) {
    return this.service.updateDraft(id, body);
  }

  @Post(':id/submit')
  @Audit('assessment_ruleset', 'submit_for_review')
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.submitForReview(id);
  }

  @Post(':id/reject')
  @Audit('assessment_ruleset', 'reject')
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reject(id);
  }

  @Post(':id/publish')
  @Audit('assessment_ruleset', 'publish')
  publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.approveAndPublish(id, user.id);
  }

  @Post(':id/retire')
  @Audit('assessment_ruleset', 'retire')
  retire(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.retire(id);
  }
}
