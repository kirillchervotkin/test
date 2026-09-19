import type { ScheduleGeneratorService as Implementation } from '../schedule-generator.service.js';
export interface ScheduleService extends Pick<Implementation, 'generate'> {}
