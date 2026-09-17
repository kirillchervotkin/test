import { ProviderType } from '../types/provider.type.js';

export interface TokenStorageArgs {
  serviceName: ProviderType;
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  externalUserId?: string;
}
