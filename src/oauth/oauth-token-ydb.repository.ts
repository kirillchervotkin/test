import { Uuid, Text, TextType } from '@ydbjs/value/primitive';
import { Optional } from '@ydbjs/value/optional';

const optionalText = (value?: string | null) =>
  new Optional(value == null ? null : new Text(value), new TextType());
import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@ydbjs/query';
import { YDB_SQL } from '../common/ydb/ydb.constants.js';
import { OAuthToken } from './entities/oAuthToken.entity.js';

@Injectable()
export class OAuthTokenYdbRepository {
  constructor(
    @Inject(YDB_SQL) private readonly sql: ReturnType<typeof query>,
  ) {}

  /** Удаляет все токены пользователя для заданного сервиса и вставляет новый */
  async storeToken(data: {
    userId: string;
    serviceName: string;
    encryptedAccessToken: string;
    ivAccess: string;
    authTagAccess: string;
    encryptedRefreshToken?: string | null;
    ivRefresh?: string | null;
    authTagRefresh?: string | null;
    expiresAt: Date;
    scope?: string | null;
    externalUserId?: string | null;
  }): Promise<OAuthToken> {
    const id = uuidv4();
    const now = new Date();

    await this.sql.begin(async (tx) => {
      // Удаляем старые токены
      await tx`
      DELETE FROM oauth_tokens
      WHERE user_id = ${new Uuid(data.userId)} AND service_name = ${data.serviceName}
    `;

      // Вставляем новый токен
      await tx`
      INSERT INTO oauth_tokens (
        id, service_name, user_id, encrypted_access_token,
        external_user_id, iv_access, auth_tag_access,
        encrypted_refresh_token, iv_refresh, auth_tag_refresh,
        expires_at, scope, created_at, updated_at, is_revoked
      ) VALUES (
        ${new Uuid(id)},
        ${data.serviceName},
        ${new Uuid(data.userId)},
        ${data.encryptedAccessToken},
        ${optionalText(data.externalUserId)},
        ${data.ivAccess},
        ${data.authTagAccess},
        ${optionalText(data.encryptedRefreshToken)},
        ${optionalText(data.ivRefresh)},
        ${optionalText(data.authTagRefresh)},
        ${data.expiresAt},
        ${optionalText(data.scope)},
        ${now},
        ${now},
        ${false}
      )
    `;
    });

    return (await this.findById(id))!;
  }

  /** Находит активный, неотозванный токен доступа по userId и сервису */
  async findAccessToken(
    userId: string,
    serviceName: string,
  ): Promise<OAuthToken | null> {
    const [result] = await this.sql`
      SELECT * FROM oauth_tokens
      WHERE user_id = ${new Uuid(userId)}
        AND service_name = ${serviceName}
        AND is_revoked = false
        AND expires_at > ${new Date()}
      ORDER BY expires_at DESC
      LIMIT 1
    `;
    const row = result[0] as Record<string, unknown> | undefined;
    return row ? this.mapRowToToken(row) : null;
  }

  /** Находит активный, неотозванный рефреш-токен */
  async findRefreshToken(
    userId: string,
    serviceName: string,
  ): Promise<OAuthToken | null> {
    const [result] = await this.sql`
      SELECT * FROM oauth_tokens
      WHERE user_id = ${new Uuid(userId)}
        AND service_name = ${serviceName}
        AND is_revoked = false
        AND encrypted_refresh_token IS NOT NULL
      ORDER BY expires_at DESC
      LIMIT 1
    `;
    const row = result[0] as Record<string, unknown> | undefined;
    return row ? this.mapRowToToken(row) : null;
  }

  /** Отзывает токен (устанавливает is_revoked = true) */
  async revokeToken(userId: string, serviceName: string): Promise<void> {
    await this.sql`
      UPDATE oauth_tokens
      SET is_revoked = true, updated_at = ${new Date()}
      WHERE user_id = ${new Uuid(userId)} AND service_name = ${serviceName}
    `;
  }

  /** Обновляет access-токен */
  async updateAccessToken(
    userId: string,
    serviceName: string,
    newEncryptedAccessToken: string,
    ivAccess: string,
    authTagAccess: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.sql`
      UPDATE oauth_tokens
      SET encrypted_access_token = ${newEncryptedAccessToken},
          iv_access = ${ivAccess},
          auth_tag_access = ${authTagAccess},
          expires_at = ${expiresAt},
          updated_at = ${new Date()}
      WHERE user_id = ${new Uuid(userId)} AND service_name = ${serviceName}
    `;
  }

  /** Получает externalUserId */
  async getExternalUserId(
    userId: string,
    serviceName: string,
  ): Promise<string | null> {
    const [result] = await this.sql`
      SELECT external_user_id FROM oauth_tokens
      WHERE user_id = ${new Uuid(userId)}
        AND service_name = ${serviceName}
        AND is_revoked = false
      ORDER BY expires_at DESC
      LIMIT 1
    `;
    if (result.length === 0) return null;
    const row = result[0] as Record<string, unknown>;
    return typeof row.external_user_id === 'string'
      ? row.external_user_id
      : null;
  }

  /** Находит userId по externalUserId и serviceName */
  async getUserIdByExternalUserId(
    externalUserId: string,
    serviceName: string,
  ): Promise<string | null> {
    const [result] = await this.sql`
      SELECT user_id FROM oauth_tokens
      WHERE external_user_id = ${externalUserId}
        AND service_name = ${serviceName}
        AND is_revoked = false
      ORDER BY expires_at DESC
      LIMIT 1
    `;
    if (result.length === 0) return null;
    const row = result[0] as Record<string, unknown>;
    return typeof row.user_id === 'string' ? row.user_id : null;
  }

  /** Обновляет externalUserId */
  async updateExternalUserId(
    userId: string,
    serviceName: string,
    externalUserId: string,
  ): Promise<void> {
    await this.sql`
      UPDATE oauth_tokens
      SET external_user_id = ${externalUserId}, updated_at = ${new Date()}
      WHERE user_id = ${new Uuid(userId)} AND service_name = ${serviceName}
    `;
  }

  /** Вспомогательный метод поиска по id */
  private async findById(id: string): Promise<OAuthToken | null> {
    const [result] = await this.sql`
      SELECT * FROM oauth_tokens WHERE id = ${new Uuid(id)}
    `;
    const row = result[0] as Record<string, unknown> | undefined;
    return row ? this.mapRowToToken(row) : null;
  }

  /** Маппинг строки результата в объект OAuthToken */
  private mapRowToToken(row: Record<string, unknown>): OAuthToken {
    return {
      id: String(row.id),
      serviceName: String(row.service_name),
      userId: String(row.user_id),
      encryptedAccessToken: String(row.encrypted_access_token),
      externalUserId:
        typeof row.external_user_id === 'string' ? row.external_user_id : null,
      ivAccess: String(row.iv_access),
      authTagAccess: String(row.auth_tag_access),
      encryptedRefreshToken:
        typeof row.encrypted_refresh_token === 'string'
          ? row.encrypted_refresh_token
          : null,
      ivRefresh: typeof row.iv_refresh === 'string' ? row.iv_refresh : null,
      authTagRefresh:
        typeof row.auth_tag_refresh === 'string' ? row.auth_tag_refresh : null,
      expiresAt: new Date(String(row.expires_at)),
      scope: typeof row.scope === 'string' ? row.scope : null,
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at)),
      isRevoked: Boolean(row.is_revoked),
    } as OAuthToken;
  }
}
