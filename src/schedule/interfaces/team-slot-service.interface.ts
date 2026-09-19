import type { TeamSlotService as Implementation } from '../schedule-crud.service.js';
export interface TeamSlotService
  extends Pick<Implementation, 'create' | 'findAll' | 'assign' | 'remove'> {}
