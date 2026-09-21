import { Module } from '@nestjs/common';
import { AssignmentController } from './assignment.controller.js';
import { MatchCrewController } from './match-crew.controller.js';
import { AssignmentService } from './assignment.service.js';
import { AssignmentRepository } from './repository/assignment.repository.js';
import { ASSIGNMENTS_SERVICE } from './tokens.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [AssignmentController, MatchCrewController],
  providers: [
    AssignmentRepository,
    { provide: ASSIGNMENTS_SERVICE, useClass: AssignmentService },
  ],
  exports: [ASSIGNMENTS_SERVICE],
})
export class AssignmentModule {}
