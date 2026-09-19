import type { StageService as Implementation } from '../schedule-crud.service.js';
export interface StageService
  extends Pick<
    Implementation,
    'create' | 'findAll' | 'findOne' | 'tree' | 'update' | 'remove'
  > {}
