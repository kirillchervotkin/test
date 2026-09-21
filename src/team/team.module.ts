// src/teams/team.module.ts

import { Module } from '@nestjs/common';
import { TeamController } from './team.controller.js';
import { TeamService } from './team.service.js';
import { TeamRepository } from './repository/team.repository.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    YdbModule, // даёт DRIZZLE для TeamRepository
    AuthModule, // даёт JwtAuthGuard для TeamController
  ],
  controllers: [TeamController],
  providers: [TeamService, TeamRepository],
  exports: [TeamService],
})
export class TeamModule {}
