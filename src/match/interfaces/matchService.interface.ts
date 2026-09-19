import type { ScheduleMatchService } from '../../schedule/schedule-crud.service.js';
export interface MatchService
  extends Pick<ScheduleMatchService, keyof ScheduleMatchService> {}
