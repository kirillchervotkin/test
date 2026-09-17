// src/camp-participant/camp-participant.module.ts

import { Module } from '@nestjs/common';
import { CampParticipantController } from './camp-participant.controller.js';
import { CampParticipantService } from './camp-participant.service.js';
import { CampParticipantYdbRepository } from './repository/camp-participant.ydb.repository.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [CampParticipantController],
  providers: [CampParticipantService, CampParticipantYdbRepository],
  exports: [CampParticipantService],
})
export class CampParticipantModule {}
