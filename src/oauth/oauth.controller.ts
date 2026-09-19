// oauth/oauth.controller.ts
import {
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { OauthConnectQueryDto } from './dto/oauthConnectQuery.dto.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { UserId } from '../auth/decorators/user-id.decorator.js';
import { OauthService } from './oauth.service.js';
import { OauthCallbackQueryDto } from './dto/oauthCallbackQuery.dto.js';
import { OAuthTokenService } from './oauthTokenService.service.js';
import { PolarApiService } from '../polar-api/polar-api.service.js';
import { BackfillService } from '../backfill/backfill.service.js';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiFoundResponse,
  ApiTags,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { CLIENT_TYPES } from './types/client.type.js';
import { PROVIDERS } from './types/provider.type.js';

type OAuthErrorCode =
  | 'invalid_state'
  | 'authorization_declined'
  | 'consents_required'
  | 'already_linked'
  | 'unsupported_client_type'
  | 'connection_failed';

@ApiTags('OAuth')
@Controller('oauth')
export class OauthController {
  private readonly logger = new Logger(OauthController.name);

  constructor(
    private readonly oauthService: OauthService,
    private readonly oauthTokenService: OAuthTokenService,
    private readonly polarApiService: PolarApiService,
    private readonly backfillService: BackfillService,
  ) {}

  /**
   * Редирект на фронтенд после завершения OAuth.
   *
   *   Успех:  /connected-accounts?polar=connected
   *   Ошибка: /connected-accounts?polar=error&reason=<code>
   */
  private redirectToFrontend(
    res: Response,
    success: boolean,
    errorCode: OAuthErrorCode | null = null,
  ): void {
    const frontendUrl = new URL(process.env.FRONTEND_URL!);
    const target = new URL('/connected-accounts', frontendUrl);

    if (success) {
      target.searchParams.set('polar', 'connected');
    } else {
      target.searchParams.set('polar', 'error');
      if (errorCode) target.searchParams.set('reason', errorCode);
    }

    res.redirect(HttpStatus.FOUND, target.href);
  }

  private redirectError(res: Response, code: OAuthErrorCode): void {
    this.redirectToFrontend(res, false, code);
  }

  private redirectSuccess(res: Response): void {
    this.redirectToFrontend(res, true);
  }

  /**
   * Локальный сброс связки Polar.
   *
   * Мы не вызываем DELETE /v3/users/{polar-user-id} — это может
   * сломать повторную регистрацию (Polar вернёт 403). Достаточно
   * удалить локальные токены; при следующем OAuth-флоу Polar выдаст
   * новый access token, а POST /v3/users отработает идемпотентно.
   */
  private async resetPolarLink(userId: string): Promise<void> {
    try {
      await this.oauthTokenService.revokeToken(userId, 'polar');
      this.logger.log(`Local Polar tokens revoked for user=${userId}`);
    } catch (error) {
      this.logger.warn(
        `revokeToken failed for user=${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('disconnect')
  @ApiOperation({
    summary: 'Полный сброс связки Polar',
    description: `Очищает сохранённые токены. После этого можно заново
                  пройти OAuth-флоу.`,
  })
  @ApiOkResponse({
    description: 'Связка сброшена (или уже отсутствовала)',
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean', example: true },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Пользователь не авторизован',
  })
  async disconnect(@UserId() userId: string) {
    await this.resetPolarLink(userId);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('status')
  @ApiOperation({
    summary: 'Актуальный статус связки Polar',
    description: `Проверяет состояние пользователя на стороне Polar через
                  GET /v3/users/{polar-user-id}.`,
  })
  async status(@UserId() userId: string) {
    const stored = await this.oauthTokenService.getTokens(userId, 'polar');

    if (!stored) {
      return { polar: { connected: false, reason: 'not_linked' as const } };
    }

    // Без externalUserId проверить статус на стороне Polar нельзя.
    if (!stored.externalUserId) {
      return { polar: { connected: null, reason: 'unknown' as const } };
    }

    try {
      const state = await this.polarApiService.getPolarUserStatus(
        stored.externalUserId,
        stored.accessToken,
      );

      return {
        polar: {
          connected: state === 'connected',
          reason: state,
        },
      };
    } catch (error) {
      this.logger.error(
        `Polar status check failed for user=${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { polar: { connected: null, reason: 'unknown' as const } };
    }
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('connect')
  @ApiOperation({
    summary: 'Получить URL для OAuth-авторизации',
    description: `Генерирует URL для редиректа пользователя на страницу авторизации
                  выбранного провайдера.`,
  })
  @ApiQuery({
    name: 'provider',
    required: true,
    enum: PROVIDERS,
  })
  @ApiQuery({
    name: 'client_type',
    required: true,
    enum: CLIENT_TYPES,
  })
  @ApiOkResponse({
    description: 'URL для OAuth-авторизации',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  @ApiInternalServerErrorResponse({ description: 'Внутренняя ошибка' })
  async connect(
    @UserId() userId: string,
    @Query() queryParams: OauthConnectQueryDto,
  ) {
    const state: string = this.oauthService.generateCryptoState();

    await this.oauthService.setState(state, {
      userId: userId,
      provider: queryParams.provider,
      client_type: queryParams.client_type,
    });

    const authUrl = this.oauthService.buildAuthUrl(queryParams.provider, state);
    return { url: authUrl };
  }

  @Get('callback')
  @ApiOperation({
    summary: 'Callback endpoint для обработки OAuth редиректа',
    description: `Обрабатывает callback от OAuth-провайдера после авторизации.

                  Порядок (v3 API):
                  1. Проверка state (CSRF)
                  2. Обмен кода на access token (v3 token endpoint).
                     В v3-ответе приходит x_user_id — это polar-user-id.
                  3. Идемпотентная регистрация через POST /v3/users.
                     Если пользователь уже зарегистрирован — Polar вернёт 200
                     с тем же polar-user-id, ошибки не будет.
                  4. Сохранение токенов и polar-user-id в БД
                  5. Backfill тренировок
                  6. Редирект (302) на /connected-accounts`,
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Код авторизации',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'State-параметр',
  })
  @ApiFoundResponse({
    description: `302-редирект на фронтенд.`,
  })
  @ApiBadRequestResponse({ description: 'Неверные параметры запроса' })
  @ApiInternalServerErrorResponse({ description: 'Ошибка обработки callback' })
  async callback(
    @Query() queryParams: OauthCallbackQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(
      `OAuth callback received | ` +
        `state=${String(queryParams.state ?? '<none>')} ` +
        `has_code=${String(Boolean(queryParams.code))} ` +
        `error=${String(queryParams.error ?? '<none>')} ` +
        `error_description=${String(queryParams.error_description ?? '<none>')} ` +
        `error_uri=${String(queryParams.error_uri ?? '<none>')}`,
    );

    try {
      const stateData = await this.oauthService.getState(queryParams.state);

      if (!stateData) {
        this.logger.warn(
          `OAuth callback: invalid or expired state | ` +
            `state=${String(queryParams.state)}`,
        );
        this.redirectError(res, 'invalid_state');
        return;
      }

      this.logger.log(
        `OAuth callback: state resolved | ` +
          `userId=${String(stateData.userId)} ` +
          `provider=${String(stateData.provider)} ` +
          `client_type=${String(stateData.client_type)}`,
      );

      if (queryParams.error || !queryParams.code) {
        const err = queryParams.error;
        const description = queryParams.error_description;

        if (err === 'access_denied') {
          this.logger.warn(
            `OAuth callback: Polar denied access | ` +
              `userId=${String(stateData.userId)} ` +
              `provider=${String(stateData.provider)} ` +
              `error=${String(err)} ` +
              `description=${String(description ?? '<none>')} ` +
              `(most likely missing mandatory consents on Polar side)`,
          );
          await this.oauthService.deleteState(queryParams.state);
          this.redirectError(res, 'consents_required');
          return;
        }

        if (err) {
          this.logger.warn(
            `OAuth callback: provider returned error | ` +
              `userId=${String(stateData.userId)} ` +
              `provider=${String(stateData.provider)} ` +
              `error=${String(err)} ` +
              `description=${String(description ?? '<none>')}`,
          );
          await this.oauthService.deleteState(queryParams.state);
          this.redirectError(res, 'authorization_declined');
          return;
        }

        this.logger.warn(
          `OAuth callback: no code and no error in callback | ` +
            `userId=${String(stateData.userId)} ` +
            `provider=${String(stateData.provider)} ` +
            `state=${String(queryParams.state)}`,
        );
        await this.oauthService.deleteState(queryParams.state);
        this.redirectError(res, 'connection_failed');
        return;
      }

      await this.oauthService.deleteState(queryParams.state);

      if (stateData.client_type !== 'web') {
        this.logger.warn(
          `OAuth callback: unsupported client_type | ` +
            `userId=${String(stateData.userId)} ` +
            `client_type=${String(stateData.client_type)}`,
        );
        this.redirectError(res, 'unsupported_client_type');
        return;
      }

      this.logger.log(
        `OAuth callback: exchanging code for tokens | ` +
          `userId=${String(stateData.userId)} ` +
          `provider=${String(stateData.provider)}`,
      );

      const tokens = await this.oauthService.exchangeCode(
        stateData.provider,
        queryParams.code,
        queryParams.state,
      );

      // v3 token response содержит x_user_id. Если он есть —
      // это и есть polar-user-id, который затем приходит
      // как `user_id` в вебхуках.
      let polarUserId: string =
        tokens.x_user_id != null ? String(tokens.x_user_id) : '';

      this.logger.log(
        `OAuth callback: token exchange succeeded | ` +
          `userId=${String(stateData.userId)} ` +
          `expires_in=${String(tokens.expires_in)} ` +
          `x_user_id=${polarUserId || '<none>'}`,
      );

      // ── Регистрация пользователя в Polar (v3) ──
      // POST /v3/users идемпотентен:
      //   - 201 Created — новый пользователь, возвращает polar-user-id;
      //   - 200 OK     — уже был зарегистрирован, возвращает тот же ID.
      // Вызываем его всегда, чтобы зафиксировать факт регистрации,
      // даже если x_user_id уже был в токене.
      try {
        const registeredId = await this.polarApiService.registerUser(
          tokens.access_token,
          stateData.userId.toString(),
          polarUserId || undefined,
        );
        polarUserId = registeredId;
        this.logger.log(
          `OAuth callback: Polar user registration ok | ` +
            `userId=${String(stateData.userId)} ` +
            `polarUserId=${polarUserId}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Пользователь уже зарегистрирован — это не ошибка.
        // Используем polarUserId из токена, если он был.
        if (
          message.includes('already registered') ||
          message.includes('duplicated member-id')
        ) {
          if (polarUserId) {
            this.logger.log(
              `User ${stateData.userId} already registered in Polar; ` +
                `using polarUserId from token: ${polarUserId}`,
            );
          } else {
            this.logger.warn(
              `User ${stateData.userId} already registered in Polar, ` +
                `but x_user_id is missing — backfill will be skipped`,
            );
          }
        }
        // Polar уже привязан к другому member.
        else if (message.includes('linked to another member')) {
          this.logger.warn(
            `OAuth callback: Polar account already linked | ` +
              `userId=${String(stateData.userId)} ` +
              `message=${message}`,
          );
          await this.resetPolarLink(stateData.userId);
          this.redirectError(res, 'already_linked');
          return;
        }
        // Согласия не приняты (403).
        else if (message.includes('forbidden') || message.includes('403')) {
          this.logger.warn(
            `OAuth callback: consents missing on Polar side | ` +
              `userId=${String(stateData.userId)} ` +
              `message=${message}`,
          );
          await this.resetPolarLink(stateData.userId);
          this.redirectError(res, 'consents_required');
          return;
        }
        // Прочие ошибки — пробрасываем.
        else {
          this.logger.error(
            `OAuth callback: registerUser failed unexpectedly | ` +
              `userId=${String(stateData.userId)} ` +
              `message=${message}`,
            error instanceof Error ? error.stack : undefined,
          );
          throw error;
        }
      }

      await this.oauthTokenService.storeTokens({
        serviceName: stateData.provider,
        userId: stateData.userId,
        accessToken: tokens.access_token,
        expiresIn: tokens.expires_in,
        externalUserId: polarUserId || undefined,
      });

      this.logger.log(
        `OAuth callback: tokens stored | ` +
          `userId=${String(stateData.userId)} ` +
          `provider=${String(stateData.provider)} ` +
          `polarUserId=${polarUserId || '<none>'}`,
      );

      // Backfill запускаем только если polarUserId известен —
      // иначе события уйдут с user_id=NaN и не найдут пользователя.
      if (polarUserId) {
        void this.backfillService
          .enqueueAllExercises(polarUserId, tokens.access_token)
          .catch((err: unknown) => {
            this.logger.error(
              `Backfill enqueue failed for polarUserId=${polarUserId}`,
              err instanceof Error ? err.stack : String(err),
            );
          });
      } else {
        this.logger.warn(
          `OAuth callback: skipping backfill — polarUserId not available | ` +
            `userId=${String(stateData.userId)}`,
        );
      }

      this.redirectSuccess(res);
    } catch (error) {
      this.logger.error(
        'OAuth callback failed; returning failure to the frontend',
        error instanceof Error ? error.stack : String(error),
      );
      this.redirectError(res, 'connection_failed');
    }
  }
}
