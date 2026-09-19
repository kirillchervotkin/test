import type { BracketSlotService as Implementation } from '../bracket-resolver.service.js';
export interface BracketSlotService
  extends Pick<Implementation, 'create' | 'findAll' | 'override' | 'remove'> {}
