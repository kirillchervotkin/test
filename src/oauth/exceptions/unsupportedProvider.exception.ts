import { ProviderType } from '../types/provider.type.js';

export class UnsupportedProviderException extends Error {
  constructor(providerType: ProviderType) {
    super(`Unsupported provider type: ${providerType}`);
    this.name = 'UnsupportedProviderException';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnsupportedProviderException);
    }
  }
}
