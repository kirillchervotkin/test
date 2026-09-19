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

/**
 * OAuth-эндпоинты Polar AccessLink v3.
 *
 * Мы сознательно используем v3-флоу авторизации, потому что:
 *   1. Только v3-эндпоинт авторизации (flow.polar.com) принимает
 *      scope `accesslink.read_all`.
 *   2. Только с этим scope работает POST /v3/users — регистрация
 *      пользователя, возвращающая polar-user-id.
 *   3. polar-user-id нужен для сопоставления вебхуков с пользователем
 *      (Polar присылает его как `user_id` в payload события).
 *
 * v4-эндпоинты данных (/v4/data/...) работают и с этим токеном,
 * если клиент одобрен в Polar Admin на соответствующие типы данных.
 *
 * Альтернатива — отдельный v4-флоу для данных — потребует двух
 * последовательных авторизаций от пользователя, что плохо для UX.
 *
 * См. https://www.polar.com/accesslink-api/#authentication
 */
const POLAR_AUTH_URL_V3 = 'https://flow.polar.com/oauth2/authorization';
const POLAR_TOKEN_URL_V3 = 'https://polarremote.com/v2/oauth2/token';

/**
 * Scope для Polar AccessLink v3.
 *
 * `accesslink.read_all` — единый исторический scope v3,
 * открывающий доступ ко всем данным и ко всем v3-эндпоинтам
 * управления пользователем (/v3/users, /v3/users/{id} и т.д.).
 *
 * Именно этот scope требуется для POST /v3/users — регистрации
 * пользователя и получения polar-user-id.
 */
const POLAR_SCOPE = 'accesslink.read_all';

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
        redirect_uri: this.polarConfig.redirectUri,
        client_id: this.polarConfig.clientId,
        scope: POLAR_SCOPE,
        state: state,
      });

      // URLSearchParams.toString() кодирует пробел как '+'.
      // Оставляем замену на '%20' на случай, если scope'ов
      // когда-нибудь станет больше одного (v4-стиль), — Polar
      // ожидает именно '%20' в качестве разделителя.
      const query = queryParams.toString().replace(/\+/g, '%20');

      // v3 authorization endpoint — flow.polar.com.
      return `${POLAR_AUTH_URL_V3}?${query}`;
    } else {
      throw new UnsupportedProviderException(providerType);
    }
  }

  public async setState(
    state: string,
    stateParams: StateParams,
    ttl?: number,
  ): Promise<void> {
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
    data.append('redirect_uri', this.polarConfig.redirectUri);
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
    let clientId: string;
    let clientSecret: string;
    let tokenEndpoint: string;

    if (provider === 'polar') {
      clientId = this.polarConfig.clientId;
      clientSecret = this.polarConfig.clientSecret;
      // v3 token endpoint — polarremote.com.
      tokenEndpoint = POLAR_TOKEN_URL_V3;
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
