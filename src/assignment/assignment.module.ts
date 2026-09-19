import { Module } from '@nestjs/common';

import { InMemoryAssignmentService } from './inMemoryAssignment.service.js';
import { ASSIGNMENTS_SERVICE } from './tokens.js';
import { AssignmentsController as AssignmentController } from './assignment.controller.js';
import { MatchModule } from '../match/match.module.js';

@Module({
  imports: [MatchModule],
  controllers: [AssignmentController],
  providers: [
    {
      provide: ASSIGNMENTS_SERVICE,
      useClass: InMemoryAssignmentService,
    },
  ],
  exports: [ASSIGNMENTS_SERVICE],
})
export class AssignmentModule {}
