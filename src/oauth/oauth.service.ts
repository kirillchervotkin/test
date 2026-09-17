import { Injectable, Inject } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { StateParams } from './interfaces/stateParams.interface.js';
import { ProviderType } from './types/provider.type.js';
import type { PolarConfig } from './interfaces/polarConfig.interface.js';
import axios, { isAxiosError } from 'axios';
import { UnsupportedProviderException } from './exceptions/unsupportedProvider.exception.js';
import { PolarAccessTokenResponse } from './interfaces/polarAccessTokenResponse.interface.js';

@Injectable()
export class OauthService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject('OAUTH_POLAR_CONFIG') private polarConfig: PolarConfig,
  ) {}

  public generateCryptoState(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  public buildAuthUrl(providerType: ProviderType, state: string): string {
    if (providerType === 'polar') {
      const queryParams = new URLSearchParams({
        response_type: 'code',
        client_id: this.polarConfig.clientId,
        state: state,
      });
      return `${this.polarConfig.baseUrl}?${queryParams.toString()}`;
    } else {
      throw new UnsupportedProviderException(providerType);
    }
  }

  public async setState(state: string, stateParams: StateParams, ttl?: number) {
    await this.cacheManager.set(state, stateParams, ttl);
  }

  public async getState(state: string): Promise<StateParams | undefined> {
    return this.cacheManager.get<StateParams>(state);
  }

  public async deleteState(state: string): Promise<void> {
    await this.cacheManager.del(state);
  }

  async sendTokenEndpointRequest(
    clientId: string,
    clientSecret: string,
    code: string,
    tokenEndpoint: string,
    state: string,
  ): Promise<PolarAccessTokenResponse> {
    const data = new URLSearchParams();
    const grantType: string = 'authorization_code';
    data.append('grant_type', grantType);
    data.append('code', code);
    data.append('state', state);

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
    };

    try {
      const response = await axios.post(tokenEndpoint, data, config);
      const polarAccessToken: PolarAccessTokenResponse =
        response.data as PolarAccessTokenResponse;
      return polarAccessToken;
    } catch (error) {
      if (isAxiosError(error)) {
        console.error(
          'Error exchanging code for token:',
          error.response?.data || error.message,
        );
      }

      throw error;
    }
  }

  async exchangeCode(
    provider: ProviderType,
    code: string,
    state: string,
  ): Promise<PolarAccessTokenResponse> {
    let clientId;
    let clientSecret: string;

    let tokenEndpoint: string;
    if (provider === 'polar') {
      clientId = this.polarConfig.clientId;
      clientSecret = this.polarConfig.clientSecret;
      tokenEndpoint = 'https://polarremote.com/v2/oauth2/token';
    } else {
      throw new UnsupportedProviderException(provider);
    }
    return await this.sendTokenEndpointRequest(
      clientId,
      clientSecret,
      code,
      tokenEndpoint,
      state,
    );
  }
}
