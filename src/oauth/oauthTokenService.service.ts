// src/oauth/oauth-token.service.ts
import { Injectable } from '@nestjs/common';
import { OAuthTokenYdbRepository } from './oauth-token-ydb.repository.js';
import { TokenEncryptionService } from './tokenEncryption.service.js';
import { TokenStorageArgs } from './interfaces/tokenStorageArg.interface.js';
import { ProviderType } from './types/provider.type.js';
import { OAuthToken } from './entities/oAuthToken.entity.js';

export interface StoredTokens {
  accessToken: string;
  externalUserId: string;
}

@Injectable()
export class OAuthTokenService {
  constructor(
    private readonly oauthTokenRepo: OAuthTokenYdbRepository,
    private readonly tokenEncryptionService: TokenEncryptionService,
  ) {}

  async storeTokens(tokenStorageArgs: TokenStorageArgs): Promise<OAuthToken> {
    const encryptedAccess = this.tokenEncryptionService.encryptToken(
      tokenStorageArgs.accessToken,
    );

    const encryptedRefresh = tokenStorageArgs.refreshToken
      ? this.tokenEncryptionService.encryptToken(tokenStorageArgs.refreshToken)
      : null;

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenStorageArgs.expiresIn);

    return this.oauthTokenRepo.storeToken({
      userId: tokenStorageArgs.userId,
      serviceName: tokenStorageArgs.serviceName,
      encryptedAccessToken: encryptedAccess.encryptedData,
      ivAccess: encryptedAccess.iv,
      authTagAccess: encryptedAccess.authTag,
      encryptedRefreshToken: encryptedRefresh?.encryptedData || null,
      ivRefresh: encryptedRefresh?.iv || null,
      authTagRefresh: encryptedRefresh?.authTag || null,
      expiresAt,
      scope: tokenStorageArgs.scope,
      externalUserId: tokenStorageArgs.externalUserId || null,
    });
  }

  async getAccessToken(
    userId: string,
    serviceName: ProviderType,
  ): Promise<string | null> {
    const tokenEntity = await this.oauthTokenRepo.findAccessToken(
      userId,
      serviceName,
    );

    if (!tokenEntity) {
      return null;
    }

    return this.tokenEncryptionService.decryptToken(
      tokenEntity.encryptedAccessToken,
      tokenEntity.ivAccess,
      tokenEntity.authTagAccess,
    );
  }

  /**
   * Возвращает расшифрованный access token и externalUserId одним запросом.
   *
   * Используется там, где для проверки статуса на стороне провайдера
   * нужны оба значения одновременно (например, GET /v3/users/{id} в Polar).
   *
   * Возвращает null, если записи нет или не сохранён externalUserId —
   * в обоих случаях проверить статус невозможно.
   */
  async getTokens(
    userId: string,
    serviceName: ProviderType,
  ): Promise<StoredTokens | null> {
    const tokenEntity = await this.oauthTokenRepo.findAccessToken(
      userId,
      serviceName,
    );

    if (!tokenEntity || !tokenEntity.externalUserId) {
      return null;
    }

    const accessToken = this.tokenEncryptionService.decryptToken(
      tokenEntity.encryptedAccessToken,
      tokenEntity.ivAccess,
      tokenEntity.authTagAccess,
    );

    return {
      accessToken,
      externalUserId: tokenEntity.externalUserId,
    };
  }

  async getRefreshToken(
    userId: string,
    serviceName: ProviderType,
  ): Promise<string | null> {
    const tokenEntity = await this.oauthTokenRepo.findRefreshToken(
      userId,
      serviceName,
    );

    if (!tokenEntity || !tokenEntity.encryptedRefreshToken) {
      return null;
    }

    return this.tokenEncryptionService.decryptToken(
      tokenEntity.encryptedRefreshToken,
      tokenEntity.ivRefresh!,
      tokenEntity.authTagRefresh!,
    );
  }

  async revokeToken(userId: string, serviceName: ProviderType): Promise<void> {
    await this.oauthTokenRepo.revokeToken(userId, serviceName);
  }

  async updateAccessToken(
    userId: string,
    serviceName: ProviderType,
    newAccessToken: string,
    expiresIn: number,
  ): Promise<void> {
    const encryptedAccess =
      this.tokenEncryptionService.encryptToken(newAccessToken);

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    await this.oauthTokenRepo.updateAccessToken(
      userId,
      serviceName,
      encryptedAccess.encryptedData,
      encryptedAccess.iv,
      encryptedAccess.authTag,
      expiresAt,
    );
  }

  async getExternalUserId(
    userId: string,
    serviceName: ProviderType,
  ): Promise<string | null> {
    return this.oauthTokenRepo.getExternalUserId(userId, serviceName);
  }

  async getUserIdByExternalUserId(
    externalUserId: string,
    serviceName: ProviderType,
  ): Promise<string | null> {
    return this.oauthTokenRepo.getUserIdByExternalUserId(
      externalUserId,
      serviceName,
    );
  }

  async updateExternalUserId(
    userId: string,
    serviceName: ProviderType,
    externalUserId: string,
  ): Promise<void> {
    await this.oauthTokenRepo.updateExternalUserId(
      userId,
      serviceName,
      externalUserId,
    );
  }
}
