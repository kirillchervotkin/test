import { Module } from '@nestjs/common';
import { CityModule } from '../city/city.module.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { TeamModule } from '../team/team.module.js';
import {
  BracketResolverService,
  BracketSlotService,
  StandingsService,
} from './bracket-resolver.service.js';
import { ScheduleRepository } from './repository/schedule.repository.js';
import {
  ScheduleIntegrityService,
  ScheduleMatchService,
  ScheduleTournamentService,
  StageService,
  TeamSlotService,
  TemplateService,
} from './schedule-crud.service.js';
import { ScheduleGeneratorService } from './schedule-generator.service.js';
import * as T from './tokens.js';
import {
  CalendarService,
  TournamentFactoryService,
} from './tournament-factory.service.js';
const services = [
  ScheduleIntegrityService,
  ScheduleTournamentService,
  ScheduleMatchService,
  StageService,
  TeamSlotService,
  TemplateService,
  ScheduleGeneratorService,
  StandingsService,
  BracketResolverService,
  BracketSlotService,
  TournamentFactoryService,
  CalendarService,
];
const aliases = [
  { provide: T.TOURNAMENTS_SERVICE, useExisting: ScheduleTournamentService },
  { provide: T.MATCHES_SERVICE, useExisting: ScheduleMatchService },
  { provide: T.STAGES_SERVICE, useExisting: StageService },
  { provide: T.TEAM_SLOTS_SERVICE, useExisting: TeamSlotService },
  { provide: T.BRACKET_SLOTS_SERVICE, useExisting: BracketSlotService },
  { provide: T.BRACKET_RESOLVER_SERVICE, useExisting: BracketResolverService },
  { provide: T.STANDINGS_SERVICE, useExisting: StandingsService },
  {
    provide: T.SCHEDULE_GENERATOR_SERVICE,
    useExisting: ScheduleGeneratorService,
  },
  { provide: T.TEMPLATES_SERVICE, useExisting: TemplateService },
  {
    provide: T.TOURNAMENT_FACTORY_SERVICE,
    useExisting: TournamentFactoryService,
  },
];
@Module({
  imports: [YdbModule, TeamModule, CityModule],
  providers: [ScheduleRepository, ...services, ...aliases],
  exports: [...services, ...aliases.map((a) => a.provide)],
})
export class ScheduleDomainModule {}
