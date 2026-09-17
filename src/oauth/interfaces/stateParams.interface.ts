import { ClientType } from '../types/client.type.js';
import { ProviderType } from '../types/provider.type.js';

export interface StateParams {
  userId: string;
  provider: ProviderType;
  client_type: ClientType;
  ttl?: number;
}
