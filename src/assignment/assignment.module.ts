import { Module } from '@nestjs/common';

import { InMemoryAssignmentService } from './inMemoryAssignment.service.js';
import { ASSIGNMENTS_SERVICE } from './tokens.js';
import { AssignmentsController as AssignmentController } from './assignment.controller.js';
import { MATCHES_SERVICE } from '../match/tokens.js';
import { InMemoryMatchService } from '../match/inMemoryMatch.service.js';

@Module({
  controllers: [AssignmentController],
  providers: [
    {
      provide: ASSIGNMENTS_SERVICE,
      useClass: InMemoryAssignmentService,
    },
    {
      provide: MATCHES_SERVICE,
      useClass: InMemoryMatchService,
    },
  ],
  exports: [ASSIGNMENTS_SERVICE],
})
export class AssignmentModule {}
