import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MatchModule } from '../match/match.module.js';
import { TournamentModule } from '../tournament/tournament.module.js';
import { ScheduleDomainModule } from './schedule-domain.module.js';
import {
  BracketSlotController,
  StageController,
  StandingsController,
  TeamSlotController,
  TemplateController,
} from './schedule.controllers.js';
@Module({
  imports: [AuthModule, ScheduleDomainModule, TournamentModule, MatchModule],
  controllers: [
    StageController,
    TeamSlotController,
    BracketSlotController,
    StandingsController,
    TemplateController,
  ],
  exports: [ScheduleDomainModule, TournamentModule, MatchModule],
})
export class ScheduleModule {}
