import { Module } from '@nestjs/common';
import { RuleSetsModule } from '../rulesets/rulesets.module';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

@Module({
  imports: [RuleSetsModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService],
})
export class AssessmentsModule {}
