// src/training/training.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { TrainingService } from './training.service.js';
import { TrainingSessionMapper } from './mappers/training-session.mapper.js';
import { ListTrainingSessionsQueryDto } from './dto/list-training-sessions-query.dto.js';
import { UpdateTrainingSessionDto } from './dto/update-training-session.dto.js';
import { ListTrainingSessionsResponseDto } from './dto/list-training-sessions-response.dto.js';
import {
  TrainingSessionListItemDto,
  TrainingSessionWithSamplesDto,
} from './dto/training-session-response.dto.js';
import { RawSamplesResponseDto } from './dto/samples-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { UserId } from '../auth/decorators/user-id.decorator.js';

/**
 * HTTP-контроллер тренировок.
 *
 * Тонкий слой: принимает HTTP, валидирует DTO через глобальный
 * ValidationPipe, делегирует в {@link TrainingService}, преобразует
 * результат через {@link TrainingSessionMapper}.
 *
 * Никакой бизнес-логики здесь нет: вся работа с БД, валидация
 * периода, трансляция null → NotFoundException живут в сервисе.
 * Контроллер не открывает транзакции и не инжектит DRIZZLE.
 *
 * Эндпоинты:
 *   GET    /training-sessions                                 — список за период
 *   GET    /training-sessions/:provider/:externalId           — одна с сэмплами
 *   GET    /training-sessions/:provider/:externalId/raw-samples — сырые блобы base64
 *   PATCH  /training-sessions/:provider/:externalId           — пользовательские поля
 *   DELETE /training-sessions/:provider/:externalId           — удаление
 *
 * POST отсутствует намеренно: тренировки приходят только от
 * провайдеров (Polar, Suunto, Garmin) через вебхуки и backfill.
 * Ручное создание через API сломало бы идемпотентность (PK
 * (user_id, provider, external_id) предполагает внешний источник).
 *
 * Все эндпоинты требуют JWT. `userId` берётся из токена через
 * {@link UserId}, не из URL: пользователь не должен иметь доступ
 * к тренировкам другого пользователя.
 */
@ApiTags('Training Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('training-sessions')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // ============================================================
  // LIST
  // ============================================================

  /**
   * Список тренировок за период [from, to).
   *
   * Сэмплы не возвращаются: список лёгкий (метаданные тренировок),
   * детали тянутся отдельно при открытии конкретной тренировки.
   *
   * Пагинации нет: период ограничен годом в сервисе, `limit`
   * защищает от гигантских ответов. За год активного пользователя
   * 250–350 тренировок — весь список влезает в один ответ.
   */
  @Get()
  @ApiOperation({
    summary: 'Список тренировок за период',
    description: `Возвращает тренировки пользователя за указанный период
                  [from, to), без сэмплов. Период не может превышать
                  ${366} дней — при превышении вернётся 400.

                  В ответе также приходит словарь \`sportTypes\` —
                  display-имена только для тех видов спорта, что
                  реально встречаются в выборке.`,
  })
  @ApiOkResponse({
    description: 'Список тренировок за период',
    type: ListTrainingSessionsResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Невалидные даты (не ISO 8601), from >= to, или период больше года',
  })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  async list(
    @UserId() userId: string,
    @Query() query: ListTrainingSessionsQueryDto,
  ): Promise<ListTrainingSessionsResponseDto> {
    const result = await this.trainingService.listSessions(
      userId,
      new Date(query.from),
      new Date(query.to),
      query.limit,
    );
    return TrainingSessionMapper.toListResult(result);
  }

  // ============================================================
  // GET ONE WITH SAMPLES
  // ============================================================

  /**
   * Одна тренировка с распакованными сэмплами.
   *
   * Samples — Partial<Record<SampleType, ParsedSample>>: отсутствующие
   * типы (провайдер их не прислал) в объекте отсутствуют, а не равны
   * null. Фронт отличает «нет данных» от «данные пустые» по наличию
   * ключа.
   */
  @Get(':provider/:externalId')
  @ApiOperation({
    summary: 'Одна тренировка с сэмплами',
    description: `Возвращает тренировку по ключу (provider, externalId)
                  со всеми распакованными сэмплами.

                  \`samples\` — объект, где ключ — тип сэмпла
                  ("hr", "speed", "power", ...), значение —
                  { intervalSec, values: number[] }.
                  Отсутствующие типы в объекте не появляются.`,
  })
  @ApiParam({
    name: 'provider',
    description: 'Провайдер: polar | suunto | garmin',
    example: 'polar',
  })
  @ApiParam({
    name: 'externalId',
    description: 'ID тренировки у провайдера (hashed id)',
    example: 'y6NNvlRM',
  })
  @ApiOkResponse({
    description: 'Тренировка с сэмплами',
    type: TrainingSessionWithSamplesDto,
  })
  @ApiNotFoundResponse({
    description: 'Тренировка не найдена или не принадлежит пользователю',
  })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  async getOne(
    @UserId() userId: string,
    @Param('provider') provider: string,
    @Param('externalId') externalId: string,
  ): Promise<TrainingSessionWithSamplesDto> {
    const result = await this.trainingService.getSessionWithSamples(
      userId,
      provider,
      externalId,
    );
    return TrainingSessionMapper.toWithSamples(result);
  }

  // ============================================================
  // GET RAW SAMPLES
  // ============================================================

  /**
   * Сырые блобы сэмплов в base64.
   *
   * Отдельный эндпоинт от `getOne`: getOne распаковывает блобы
   * в JSON-массивы (удобно для отладки и прямого рендеринга), а
   * raw-samples отдаёт блобы как есть в base64 — фронт сам
   * декодирует в DataView. Это экономит трафик (в 8–10 раз против
   * JSON-массива) и CPU на бэке (нет распаковки → переупаковки).
   *
   * ⚠️ Требует расширения TrainingService.getRawSamples: сейчас
   * метод возвращает только карту сэмплов, без sessionId. Чтобы
   * вернуть sessionId в ответе, сервис должен возвращать
   * { sessionId, samples }. См. патч сервиса ниже.
   */
  @Get(':provider/:externalId/raw-samples')
  @ApiOperation({
    summary: 'Сырые блобы сэмплов в base64',
    description: `Возвращает блобы сэмплов как есть, упакованные в base64.
                  Используется фронтом для рендеринга графиков без
                  промежуточного шага «распаковать на бэке → сериализовать
                  в JSON → распаковать на фронте».

                  Формат base64-блоба: little-endian, 1 байт на точку
                  для hr/cadence/temperature, 2 байта для power/distance,
                  4 байта для speed/altitude.`,
  })
  @ApiParam({
    name: 'provider',
    description: 'Провайдер: polar | suunto | garmin',
    example: 'polar',
  })
  @ApiParam({
    name: 'externalId',
    description: 'ID тренировки у провайдера (hashed id)',
    example: 'y6NNvlRM',
  })
  @ApiOkResponse({
    description: 'Сырые блобы сэмплов в base64',
    type: RawSamplesResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Тренировка не найдена или не принадлежит пользователю',
  })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  async getRawSamples(
    @UserId() userId: string,
    @Param('provider') provider: string,
    @Param('externalId') externalId: string,
  ): Promise<RawSamplesResponseDto> {
    const result = await this.trainingService.getRawSamplesWithSession(
      userId,
      provider,
      externalId,
    );
    return TrainingSessionMapper.toRawSamplesResponse(
      result.sessionId,
      result.samples,
    );
  }

  // ============================================================
  // PATCH (user fields)
  // ============================================================

  /**
   * Обновление пользовательских полей тренировки.
   *
   * Меняются только name, notes, sport. Провайдерские метрики
   * (distance, hr, calories, время, сэмплы) неизменны через API —
   * они источник истины в Polar/Suunto.
   *
   * Семантика полей (см. UpdateTrainingSessionDto):
   *   - ключ отсутствует → «не трогать»;
   *   - `null`           → «очистить»;
   *   - значение         → «записать».
   */
  @Patch(':provider/:externalId')
  @ApiOperation({
    summary: 'Обновить пользовательские поля тренировки',
    description: `Обновляет name, notes, sport. Провайдерские метрики
                  (distance, hr, calories, время, сэмплы) неизменны.

                  Передайте \`null\` для поля, чтобы очистить его.`,
  })
  @ApiParam({
    name: 'provider',
    description: 'Провайдер: polar | suunto | garmin',
    example: 'polar',
  })
  @ApiParam({
    name: 'externalId',
    description: 'ID тренировки у провайдера (hashed id)',
    example: 'y6NNvlRM',
  })
  @ApiOkResponse({
    description: 'Обновлённая тренировка',
    type: TrainingSessionListItemDto,
  })
  @ApiBadRequestResponse({ description: 'Невалидное тело запроса' })
  @ApiNotFoundResponse({
    description: 'Тренировка не найдена или не принадлежит пользователю',
  })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  async patch(
    @UserId() userId: string,
    @Param('provider') provider: string,
    @Param('externalId') externalId: string,
    @Body() dto: UpdateTrainingSessionDto,
  ): Promise<TrainingSessionListItemDto> {
    const updated = await this.trainingService.updateUserFields(
      userId,
      provider,
      externalId,
      TrainingSessionMapper.toUpdateData(dto),
    );
    return TrainingSessionMapper.toListItem(updated);
  }

  // ============================================================
  // DELETE
  // ============================================================

  /**
   * Удаление тренировки вместе со всеми её сэмплами.
   *
   * Одна транзакция внутри репозитория: либо удаляется всё, либо
   * ничего. «Висячих» сэмплов без родителя не остаётся.
   */
  @Delete(':provider/:externalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить тренировку',
    description: `Удаляет тренировку и все её сэмплы атомарно.
                  Возвращает 204 в случае успеха.`,
  })
  @ApiParam({
    name: 'provider',
    description: 'Провайдер: polar | suunto | garmin',
    example: 'polar',
  })
  @ApiParam({
    name: 'externalId',
    description: 'ID тренировки у провайдера (hashed id)',
    example: 'y6NNvlRM',
  })
  @ApiNoContentResponse({ description: 'Тренировка удалена' })
  @ApiNotFoundResponse({
    description: 'Тренировка не найдена или не принадлежит пользователю',
  })
  @ApiUnauthorizedResponse({ description: 'Пользователь не авторизован' })
  async remove(
    @UserId() userId: string,
    @Param('provider') provider: string,
    @Param('externalId') externalId: string,
  ): Promise<void> {
    await this.trainingService.deleteSession(userId, provider, externalId);
  }
}
