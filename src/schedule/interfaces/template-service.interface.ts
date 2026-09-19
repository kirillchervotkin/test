import type { TemplateService as Implementation } from '../schedule-crud.service.js';
export interface TemplateService
  extends Pick<
    Implementation,
    'create' | 'findAll' | 'findOne' | 'update' | 'remove'
  > {}
