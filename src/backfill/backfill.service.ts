// backfill/backfill.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PolarApiService } from '../polar-api/polar-api.service.js';
import {
  QueueProducerService,
  type PolarWebhookEvent,
} from '../queue/queue-producer.service.js';

/**
 * Результат постановки тренировок в очередь.
 * Возвращается в OAuth-колбэк для логирования и метрик.
 */
export interface BackfillResult {
  polarUserId: string;
  /** Сколько тренировок вернул Polar API */
  fetched: number;
  /** Сколько успешно поставлено в очередь */
  enqueued: number;
  /** Период, за который тянули данные */
  from: string;
  to: string;
  /** Сколько заняло времени, мс */
  durationMs: number;
}

/**
 * Сервис массовой постановки тренировок в очередь.
 *
 * Используется в двух сценариях:
 *   1. При OAuth-связывании — поставить все доступные тренировки пользователя.
 *   2. По требованию (admin-эндпоинт, cron) — переобработать историю.
 *
 * Сам ничего не обрабатывает: только читает список из Polar API
 * и раскладывает задачи в очередь. Реальная обработка — в WebhookService.
 */
@Injectable()
export class BackfillService {
  private readonly logger = new Logger(BackfillService.name);

  /**
   * Polar без features разрешает диапазон до 90 дней за один запрос.
   * Для backfill нам нужны только ID тренировок, поэтому features не передаём.
   */
  private static readonly MAX_RANGE_DAYS = 90;

  constructor(
    private readonly polarApi: PolarApiService,
    private readonly queueProducer: QueueProducerService,
  ) {}

  /**
   * Поставить в очередь все тренировки пользователя за последние 90 дней.
   *
   * Метод не бросает исключений при частичных сбоях: если часть
   * тренировок не удалось поставить — вернёт реальное число `enqueued`,
   * а ошибки залогирует. Это позволяет OAuth-колбэку не падать,
   * даже если MQ временно недоступна.
   */
  async enqueueAllExercises(
    polarUserId: string,
    accessToken: string,
  ): Promise<BackfillResult> {
    const startedAt = Date.now();

    const to = new Date();
    const from = new Date(
      to.getTime() - BackfillService.MAX_RANGE_DAYS * 24 * 60 * 60 * 1000,
    );

    this.logger.log(
      `Backfill start | polarUserId=${polarUserId} | ` +
        `from=${from.toISOString()} to=${to.toISOString()}`,
    );

    const response = await this.polarApi.listTrainingSessions({
      accessToken,
      from,
      to,
    });

    const sessions = response.trainingSessions;
    this.logger.log(
      `Backfill: Polar returned ${sessions.length} session(s) ` +
        `for polarUserId=${polarUserId}`,
    );

    if (sessions.length === 0) {
      return {
        polarUserId,
        fetched: 0,
        enqueued: 0,
        from: from.toISOString(),
        to: to.toISOString(),
        durationMs: Date.now() - startedAt,
      };
    }

    const events: PolarWebhookEvent[] = sessions.map((session) => ({
      event: 'EXERCISE',
      user_id: Number(polarUserId),
      entity_id: session.identifier.id,
      timestamp: session.startTime,
      url: `https://www.polaraccesslink.com/v3/exercises/${session.identifier.id}`,
    }));

    const enqueued = await this.queueProducer.sendPolarWebhooksBatch(events);
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `Backfill done | polarUserId=${polarUserId} | ` +
        `fetched=${sessions.length} enqueued=${enqueued} | ${durationMs}ms`,
    );

    return {
      polarUserId,
      fetched: sessions.length,
      enqueued,
      from: from.toISOString(),
      to: to.toISOString(),
      durationMs,
    };
  }

  /**
   * Поставить в очередь конкретную тренировку (по её ID).
   * Полезно для admin-эндпоинта «переобработать одну тренировку».
   */
  async enqueueExercise(
    polarUserId: string,
    entityId: string,
    timestamp: string,
  ): Promise<void> {
    await this.queueProducer.sendPolarWebhook({
      event: 'EXERCISE',
      user_id: Number(polarUserId),
      entity_id: entityId,
      timestamp,
      url: `https://www.polaraccesslink.com/v3/exercises/${entityId}`,
    });

    this.logger.log(
      `Enqueued single exercise | polarUserId=${polarUserId} entity=${entityId}`,
    );
  }
}
