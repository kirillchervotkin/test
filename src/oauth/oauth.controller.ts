import {
  Controller,
  Get,
  Logger,
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
  ApiResponse,
  ApiTags,
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { CLIENT_TYPES } from './types/client.type.js';
import { PROVIDERS } from './types/provider.type.js';

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

  private sendErrorResponse(res: Response, error: string, status: HttpStatus) {
    res.status(status).send(`
      <script>
        window.opener.postMessage({ 
          type: 'OAUTH_CONNECT', 
          success: false, 
          error: ${JSON.stringify(error)}
        }, '*');
        window.close();
      </script>
    `);
  }

  private sendSuccessResponse(res: Response) {
    return res.status(HttpStatus.OK).send(`
        <script>
          window.opener.postMessage({ 
            type: 'OAUTH_CONNECT', 
            success: true 
          }, '*');
          window.close();
        </script>
      `);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('connect')
  @ApiOperation({
    summary: 'Получить URL для OAuth-авторизации',
    description: `Генерирует URL для перенаправления пользователя на страницу авторизации выбранного провайдера.
                  Создает state параметр для безопасности OAuth потока и сохраняет его в кеше с данными пользователя.`,
  })
  @ApiQuery({
    name: 'provider',
    required: true,
    enum: PROVIDERS,
    description: 'Провайдер OAuth (например: polar, garmin)',
  })
  @ApiQuery({
    name: 'client_type',
    required: true,
    enum: CLIENT_TYPES,
    description: 'Тип клиента (web или mobile)',
  })
  @ApiOkResponse({
    description: 'URL для OAuth-авторизации',
    schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          example: 'https://provider.com/oauth/authorize?state=abc123',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Пользователь не авторизован',
  })
  @ApiInternalServerErrorResponse({
    description: 'Внутренняя ошибка сервера при генерации URL авторизации',
  })
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
    description: `Endpoint для обработки callback от OAuth провайдера после авторизации пользователя.
                  Выполняет следующие действия:
                  1. Проверяет state параметр для безопасности
                  2. Обменивает код авторизации на access token
                  3. Регистрирует пользователя в Polar API
                  4. Сохраняет OAuth токены
                  5. Ставит в очередь задания на обработку всех тренировок (backfill)
                  6. Возвращает HTML страницу которая закрывает окно и сообщает результат в родительское окно`,
  })
  @ApiQuery({
    name: 'code',
    required: true,
    description: 'Код авторизации, полученный от OAuth провайдера',
    example: 'abc123def456',
  })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'State параметр для защиты от CSRF атак',
    example: 'a1b2c3d4e5f6',
  })
  @ApiResponse({
    status: 200,
    description: `Успешная OAuth авторизация. Возвращает HTML страницу которая:
                  - Отправляет сообщение об успехе в родительское окно
                  - Закрывает текущее окно`,
    content: {
      'text/html': {
        example: `
          <script>
            window.opener.postMessage({ 
              type: 'OAUTH_CONNECT', 
              success: true 
            }, '*');
            window.close();
          </script>
        `,
      },
    },
  })
  @ApiBadRequestResponse({
    description: `Неверные параметры запроса:
                  - Невалидный state параметр
                  - Неподдерживаемый client_type
                  - Отсутствует код авторизации`,
    content: {
      'text/html': {
        example: `
          <script>
            window.opener.postMessage({ 
              type: 'OAUTH_CONNECT', 
              success: false, 
              error: "invalid state" 
            }, '*');
            window.close();
          </script>
        `,
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: `Ошибка при обработке OAuth callback:
                  - Ошибка обмена кода на токен
                  - Ошибка регистрации пользователя в Polar API
                  - Ошибка сохранения токенов в БД`,
    content: {
      'text/html': {
        example: `
          <script>
            window.opener.postMessage({ 
              type: 'OAUTH_CONNECT', 
              success: false, 
              error: "Internal server error" 
            }, '*');
            window.close();
          </script>
        `,
      },
    },
  })
  async callback(
    @Query() queryParams: OauthCallbackQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const stateData = await this.oauthService.getState(queryParams.state);

    if (!stateData) {
      this.sendErrorResponse(res, 'invalid state', HttpStatus.BAD_REQUEST);
      return;
    }
    await this.oauthService.deleteState(queryParams.state);

    const tokens = await this.oauthService.exchangeCode(
      stateData.provider,
      queryParams.code,
      queryParams.state,
    );

    await this.polarApiService.registerUser(
      tokens.access_token,
      stateData.userId.toString(),
    );

    await this.oauthTokenService.storeTokens({
      serviceName: stateData.provider,
      userId: stateData.userId,
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
      externalUserId: tokens.x_user_id,
    });

    // Fire-and-forget: ставим в очередь все тренировки за 90 дней.
    // Пользователь не должен ждать — обработка пойдёт асинхронно
    // через тот же пайплайн, что и реальные Polar-вебхуки.
    void this.backfillService
      .enqueueAllExercises(String(tokens.x_user_id), tokens.access_token)
      .catch((err: unknown) => {
        this.logger.error(
          `Backfill enqueue failed for polarUserId=${tokens.x_user_id}`,
          err instanceof Error ? err.stack : String(err),
        );
      });

    if (stateData.client_type === 'web') {
      this.sendSuccessResponse(res);
      return;
    } else {
      this.sendErrorResponse(
        res,
        'Unsupported client type',
        HttpStatus.BAD_REQUEST,
      );
      return;
    }
  }
}
