import type { StandingsService as Implementation } from '../bracket-resolver.service.js';
export interface StandingsService extends Pick<Implementation, 'calculate'> {}
