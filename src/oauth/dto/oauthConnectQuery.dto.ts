import { IsIn } from 'class-validator';
import * as providerType from '../types/provider.type.js';
import * as clientType from '../types/client.type.js';

export class OauthConnectQueryDto {
  @IsIn(providerType.PROVIDERS)
  provider: providerType.ProviderType;

  @IsIn(clientType.CLIENT_TYPES)
  client_type: clientType.ClientType;
}
