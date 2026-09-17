import { AsyncLocalStorage } from 'async_hooks';
import { ConstraintMessages } from '../decorators/unique.decorator.js';

export interface MappingContext {
  columnMapping: Record<string, string>;
  validationMessages: Record<string, ConstraintMessages>;
}

export const mappingStorage = new AsyncLocalStorage<MappingContext>();
