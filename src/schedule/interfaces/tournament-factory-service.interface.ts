import type { TournamentFactoryService as Implementation } from '../tournament-factory.service.js';
export interface TournamentFactoryService
  extends Pick<Implementation, 'createFromTemplate'> {}
