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
 *
 * ВАЖНО: polarUserId здесь — это Polar user-id (x_user_id), который
 * мы получаем при регистрации пользователя через v3 API (POST /v3/users).
 * Именно это значение приходит как `user_id` в вебхуках, поэтому
 * без него невозможно связать тренировки с пользователем в БД.
 *
 * ВАЖНО: используется v3-эндпоинт GET /v3/exercises. Он:
 *   - возвращает МАССИВ тренировок напрямую (не объект);
 *   - использует snake_case в полях (id, start_time);
 *   - отдаёт только тренировки за последние 30 дней
 *     и не принимает from/to — фильтрация по диапазону
 *     выполняется на стороне PolarApiService.
 *
 * Поэтому MAX_RANGE_DAYS фактически ограничен 30 днями на стороне
 * Polar, а более старые тренировки в этот вызов не попадут.
 */
@Injectable()
export class BackfillService {
  private readonly logger = new Logger(BackfillService.name);

  /**
   * Запрашиваемый диапазон backfill. Реально Polar v3 отдаёт
   * только 30 дней, но мы просим 90 — лишнее отфильтруется
   * на стороне сервиса, и логика останется совместимой,
   * если Polar расширит окно.
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

    // listTrainingSessions возвращает ExerciseV3[] напрямую —
    // v3-эндпоинт GET /v3/exercises отдаёт массив, а не объект.
    const exercises = await this.polarApi.listTrainingSessions({
      accessToken,
      from,
      to,
    });

    this.logger.log(
      `Backfill: Polar returned ${exercises.length} exercise(s) ` +
        `for polarUserId=${polarUserId}`,
    );

    if (exercises.length === 0) {
      return {
        polarUserId,
        fetched: 0,
        enqueued: 0,
        from: from.toISOString(),
        to: to.toISOString(),
        durationMs: Date.now() - startedAt,
      };
    }

    const events: PolarWebhookEvent[] = exercises.map((ex) => ({
      event: 'EXERCISE',
      user_id: Number(polarUserId),
      // v3 использует snake_case: id, start_time.
      entity_id: ex.id,
      timestamp: ex.start_time,
      url: `https://www.polaraccesslink.com/v3/exercises/${ex.id}`,
    }));

    const enqueued = await this.queueProducer.sendPolarWebhooksBatch(events);
    const durationMs = Date.now() - startedAt;

    this.logger.log(
      `Backfill done | polarUserId=${polarUserId} | ` +
        `fetched=${exercises.length} enqueued=${enqueued} | ${durationMs}ms`,
    );

    return {
      polarUserId,
      fetched: exercises.length,
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
