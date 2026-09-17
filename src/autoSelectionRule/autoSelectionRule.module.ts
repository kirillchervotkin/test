import { Module } from '@nestjs/common';
import { AutoSelectionRuleController } from './autoSelectionRule.controller.js';
import { AUTO_SELECTION_RULE_SERVICE } from './tokens.js';
import { InMemoryAutoSelectionRuleService } from './inMemoryAutoSelectionRuleService.js';

@Module({
  controllers: [AutoSelectionRuleController],
  providers: [
    {
      provide: AUTO_SELECTION_RULE_SERVICE,
      useClass: InMemoryAutoSelectionRuleService,
    },
  ],
  exports: [AUTO_SELECTION_RULE_SERVICE],
})
export class AutoSelectionRuleModule {}
