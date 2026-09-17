import { ConstraintMessages } from './constraint.interface.js';

export interface MappingContext {
  columnMapping: Record<string, string>;
  validationMessages: Record<string, ConstraintMessages>;
}
