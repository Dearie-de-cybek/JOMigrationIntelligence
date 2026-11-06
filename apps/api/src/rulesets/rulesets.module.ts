import { Module } from '@nestjs/common';
import { RuleSetsController } from './rulesets.controller';
import { PathwaysController } from './pathways.controller';
import { RuleSetsService } from './rulesets.service';

@Module({
  controllers: [RuleSetsController, PathwaysController],
  providers: [RuleSetsService],
  exports: [RuleSetsService],
})
export class RuleSetsModule {}
