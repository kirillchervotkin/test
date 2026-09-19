import type { ScheduleTournamentService } from '../../schedule/schedule-crud.service.js';
export interface TournamentsService
  extends Pick<ScheduleTournamentService, keyof ScheduleTournamentService> {}
