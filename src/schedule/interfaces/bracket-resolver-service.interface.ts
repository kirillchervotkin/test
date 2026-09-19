import type { BracketResolverService as Implementation } from '../bracket-resolver.service.js';
export interface BracketResolverService
  extends Pick<Implementation, 'resolve'> {}
