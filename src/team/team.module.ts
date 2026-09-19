import { TeamRepository } from './repository/team.repository.js';
import { ScheduleRepository } from '../schedule/repository/schedule.repository.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { Module } from '@nestjs/common';
import { TeamController } from './team.controller.js';
import { TEAM_SERVICE } from './tokens.js';
import { YdbTeamService } from './team.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  controllers: [TeamController],
  imports: [
    YdbModule,
    AuthModule, // для JWT-защиты
  ],
  providers: [
    ScheduleRepository,
    TeamRepository,
    {
      provide: TEAM_SERVICE,
      useClass: YdbTeamService,
    },
  ],
  exports: [TEAM_SERVICE],
})
export class TeamModule {}
