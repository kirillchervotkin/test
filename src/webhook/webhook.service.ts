// src/webhook/webhook.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { ZodError } from 'zod';

import { OAuthTokenService } from '../oauth/oauthTokenService.service.js';
import { PolarApiService } from '../polar-api/polar-api.service.js';
import { TrainingService } from '../training/training.service.js';
import { PolarAdapter } from '../training/adapters/polar.adapter.js';
import type { TriggerPayloadDto } from '../trigger/dto/trigger-payload.dto.js';
import {
  PolarWebhookEventSchema,
  type PolarWebhookEvent,
} from './dto/polar-webhook.schema.js';

/**
 * Одно trigger-сообщение из payload.
 * Выводим из DTO, чтобы не дублировать тип.
 */
type TriggerMessage = TriggerPayloadDto['messages'][number];

/**
 * Максимальная глубина разворота обёрток.
 * Защищает от гипотетического бесконечного цикла при циклических
 * структурах или самоссылающихся payload'ах.
 */
const MAX_UNWRAP_DEPTH = 10;

/**
 * Обработчик вебхуков Polar.
 *
 * Вся логика приёма сосредоточена здесь:
 *   1. Развернуть обёртки сообщения (YMQ envelope → API Gateway
 *      envelope → Polar webhook).
 *   2. Провалидировать Polar-payload через zod.
 *   3. Диспатчить по типу события (PING / EXERCISE / ...).
 *   4. Для EXERCISE — забрать полную тренировку из Polar,
 *      смапить через PolarAdapter, сохранить через TrainingService.
 *
 * Контроллер только принимает HTTP и вызывает handleTriggerPayload —
 * он ничего не знает про формат сообщений и обработку событий.
 *
 * Ошибки уровня одного сообщения логируются, но не прерывают
 * batch: следующее сообщение обрабатывается независимо.
 * Ошибки на уровне HTTP (невалидный TriggerPayloadDto) уходят
 * наверх и превращаются в 400 через ValidationPipe.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly oauthTokenService: OAuthTokenService,
    private readonly polarApi: PolarApiService,
    private readonly trainingService: TrainingService,
    private readonly polarAdapter: PolarAdapter,
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  PUBLIC ENTRY POINT
  // ═══════════════════════════════════════════════════════════

  /**
   * Обрабатывает trigger payload целиком.
   *
   * Вызывается из WebhookController. Итерируется по messages,
   * каждое сообщение обрабатывается независимо — ошибка одного
   * не роняет остальные.
   *
   * Не бросает исключений: любая ошибка (разбор, валидация,
   * обработка) логируется и приводит к skip текущего сообщения.
   * Это правильно для batch-обработки из очереди: сообщение
   * всё равно вернётся по visibility timeout, если мы его не
   * удалим, но продолжать batch мы можем.
   */
  async handleTriggerPayload(payload: TriggerPayloadDto): Promise<void> {
    this.logger.debug(`Received ${payload.messages.length} trigger message(s)`);

    for (const msg of payload.messages) {
      await this.handleTriggerMessage(msg);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  MESSAGE PIPELINE
  // ═══════════════════════════════════════════════════════════

  /**
   * Полный цикл обработки одного trigger-сообщения:
   * развернуть → валидировать → диспатчить.
   */
  private async handleTriggerMessage(msg: TriggerMessage): Promise<void> {
    const messageId = msg.details.message.message_id;

    // ── 1. Развернуть обёртки ──
    const rawPolar = this.extractPolarEvent(msg.details.message.body);
    if (rawPolar === undefined) {
      this.logger.error(
        `[${messageId}] Could not extract Polar event from message. ` +
          `Raw: ${this.stringify(msg.details.message.body, 500)}`,
      );
      return;
    }

    // ── 2. Валидировать через zod ──
    let polarEvent: PolarWebhookEvent;
    try {
      polarEvent = PolarWebhookEventSchema.parse(rawPolar);
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        this.logger.error(
          `[${messageId}] Polar webhook validation failed: ` +
            err.issues
              .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
              .join('; ') +
            ` | Raw: ${this.stringify(rawPolar, 500)}`,
        );
      } else {
        this.logger.error(
          `[${messageId}] Polar webhook parsing crashed unexpectedly`,
          err instanceof Error ? err.stack : String(err),
        );
      }
      return;
    }

    // ── 3. Диспатч ──
    try {
      await this.dispatchEvent(polarEvent, messageId);
    } catch (err: unknown) {
      this.logger.error(
        `[${messageId}] Event processing failed`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Диспетчеризация разобранного события по обработчикам.
   *
   * PING — no-op (Polar использует его для проверки доступности
   * endpoint при настройке вебхука).
   *
   * EXERCISE — забрать полную тренировку и сохранить.
   *
   * Остальные типы (SLEEP, ACTIVITY) — пока не обрабатываются,
   * логируем warning.
   */
  private async dispatchEvent(
    event: PolarWebhookEvent,
    messageId: string,
  ): Promise<void> {
    switch (event.event) {
      case 'PING':
        this.logger.log(`[${messageId}] PING received`);
        return;

      case 'EXERCISE':
        await this.handleExercise(event.user_id, event.entity_id);
        return;

      case 'SLEEP':
      case 'ACTIVITY':
        this.logger.warn(
          `[${messageId}] Unsupported event type: ${event.event}`,
        );
        return;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Обработка события EXERCISE.
   *
   * Порядок:
   *   1. Резолвим внутренний userId по polar-user-id из payload.
   *   2. Берём access token пользователя.
   *   3. Тянем полную тренировку из Polar (с samples).
   *   4. Маппим через PolarAdapter.
   *   5. Сохраняем через TrainingService (идемпотентный upsert).
   *
   * Не бросает HTTP-исключений — любой сбой логируется
   * вызывающим dispatchEvent'ом.
   */
  async handleExercise(polarUserId: number, entityId: string): Promise<void> {
    // 1. Резолв внутреннего userId.
    const userId = await this.oauthTokenService.getUserIdByExternalUserId(
      String(polarUserId),
      'polar',
    );

    if (!userId) {
      this.logger.warn(
        `EXERCISE polarUserId=${polarUserId} entity=${entityId}: ` +
          `no matching Arbitrator user — skipping`,
      );
      return;
    }

    // 2. Access token.
    const accessToken = await this.oauthTokenService.getAccessToken(
      userId,
      'polar',
    );

    if (!accessToken) {
      this.logger.warn(
        `EXERCISE polarUserId=${polarUserId} userId=${userId}: ` +
          `no access token — skipping`,
      );
      return;
    }

    // 3. Полная тренировка с samples.
    const exercise = await this.polarApi.getExercise(entityId, {
      accessToken,
      includeSamples: true,
    });

    // 4. Маппинг в канонические типы.
    const sessionData = this.polarAdapter.toSessionData(exercise, userId);
    const samples = this.polarAdapter.toSamples(exercise);

    // 5. Сохранение — тренировка и все блобы сэмплов
    //    в одной транзакции, идемпотентно.
    const session = await this.trainingService.saveSessionWithSamples(
      sessionData,
      samples,
    );

    this.logger.log(
      `EXERCISE saved | polarUserId=${polarUserId} userId=${userId} ` +
        `entity=${entityId} sessionId=${session.id} ` +
        `channels=${samples.length} ` +
        `[${samples.map((s) => s.sampleType).join(',')}]`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  ENVELOPE UNWRAPPING
  // ═══════════════════════════════════════════════════════════

  /**
   * Рекурсивно разворачивает обёртки сообщения из очереди
   * и достаёт объект Polar-вебхука (тот, у которого есть поле
   * `event`).
   *
   * Поддерживаемые формы обёрток (в любом порядке вложенности):
   *   - строка с JSON           → JSON.parse и продолжаем;
   *   - { event: "..." }        → целевой Polar-вебхук, возвращаем;
   *   - { messages: [ ... ] }   → берём первый элемент и продолжаем;
   *   - { details: { message: { body: "..." } } } → разворачиваем body;
   *   - { body: "..." }         → API Gateway envelope, разворачиваем body.
   *
   * Возвращает undefined, если за MAX_UNWRAP_DEPTH шагов
   * не удалось добраться до объекта с `event`.
   */
  private extractPolarEvent(raw: unknown, depth = 0): unknown {
    if (depth > MAX_UNWRAP_DEPTH) return undefined;
    if (raw == null) return undefined;

    // Строка — пробуем распарсить как JSON.
    if (typeof raw === 'string') {
      try {
        return this.extractPolarEvent(JSON.parse(raw), depth + 1);
      } catch {
        return undefined;
      }
    }

    if (typeof raw !== 'object') return undefined;

    const obj = raw as Record<string, unknown>;

    // Уже Polar-вебхук — у него есть поле event.
    if (typeof obj.event === 'string') {
      return obj;
    }

    // Trigger payload с массивом messages — берём первое.
    if (Array.isArray(obj.messages) && obj.messages.length > 0) {
      return this.extractPolarEvent(obj.messages[0], depth + 1);
    }

    // Одиночный trigger-message:
    // { details: { message: { body: "..." } } }
    const details = obj.details as { message?: { body?: unknown } } | undefined;
    if (details?.message && 'body' in details.message) {
      return this.extractPolarEvent(details.message.body, depth + 1);
    }

    // API Gateway envelope или любая другая обёртка с полем body.
    if ('body' in obj) {
      return this.extractPolarEvent(obj.body, depth + 1);
    }

    return undefined;
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════

  /**
   * Безопасно превращает данные в строку и обрезает до max символов.
   * Нужен для логирования сырых payload'ов без раздувания логов.
   */
  private stringify(data: unknown, max: number): string {
    try {
      const s = typeof data === 'string' ? data : JSON.stringify(data);
      if (!s) return '';
      return s.length > max ? `${s.slice(0, max)}…` : s;
    } catch {
      return String(data);
    }
  }
}
