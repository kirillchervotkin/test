// src/training/repositories/training.repository.ts

import { Injectable, Inject, Logger } from '@nestjs/common';
import { YDBError } from '@ydbjs/error';
import { and, asc, desc, eq, gte, lt, sql, SQL } from 'drizzle-orm';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { trainingSessions } from '../entities/training-session.schema.js';
import { trainingSamples } from '../entities/training-sample.schema.js';

import {
  type TrainingSession,
  type CreateTrainingSessionData,
  type UpdateTrainingSessionData,
  makeSessionId,
} from '../entities/types/training-session.types.js';
import {
  type SampleType,
  type TrainingSample,
  packSamples,
  unpackSamples,
} from '../entities/types/training-samples.types.js';

type DrizzleDb = YdbDrizzleDatabase;
type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];
type DrizzleRunner = DrizzleDb | DrizzleTx;

// ============================================================
// YDB ERROR CODES
// ============================================================
//
// 400120 — нарушение UNIQUE-ограничения.
//
// Кода FK-violation нет: YDB не enforced FK на уровне движка.
// В этом репозитории FK не проверяются вообще:
//   - user_id в training_sessions приходит из JWT (@UserId()),
//     то есть уже доверенный;
//   - session_id в training_samples — детерминированный хеш
//     из makeSessionId, вычисляется в этом же файле.
//
const YDB_UNIQUE_VIOLATION_CODE = 400120;

// ============================================================
// YDB NULL-TYPE WORKAROUNDS
// ============================================================

/**
 * Для каждого поля типа `T[K]` возвращает `Exclude<T[K], null> | SQL`.
 * Используется, чтобы заменить JS-`null` на SQL-литерал `NULL`.
 */
type SqlOrValue<T> = Exclude<T, null> | SQL;

/**
 * Заменяет `null`-значения в объекте на SQL-литерал `NULL`
 * (через sql-шаблон), оставляя остальные значения без изменений.
 *
 * Зачем это нужно:
 *   Драйвер YDB сериализует JS-`null` как protobuf `null_type`,
 *   который YDB не принимает в bind-параметрах:
 *     GENERIC_ERROR: Unsupported protobuf type: null_type: NULL_VALUE.
 *   Литерал `NULL`, вставленный через sql`NULL`, идёт в текст SQL,
 *   а не в `$pN`, и такой проблемы не вызывает.
 *
 * Применяется ТОЛЬКО на update-путях, где `null` означает
 * «очистить значение». На insert-путях null-поля отсекаются
 * фильтром filterNullish, чтобы отсутствующие в INSERT колонки
 * YDB заполнил NULL по умолчанию — уже без явного null-параметра.
 */
function nullsToSql<T extends object>(
  obj: T,
): { [K in keyof T]: SqlOrValue<T[K]> } {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === null ? sql`NULL` : value;
  }
  return result as { [K in keyof T]: SqlOrValue<T[K]> };
}

/**
 * Убирает из объекта ключи со значением `undefined` и `null`.
 *
 * Зачем: Drizzle включает в INSERT/UPDATE только те колонки,
 * которые реально присутствуют в объекте values. Если ключ со
 * значением `null` остаётся — драйвер YDB пытается сериализовать
 * его как protobuf `null_type` и падает на GENERIC_ERROR.
 * Отсутствие ключа решает проблему: YDB оставляет колонку как
 * есть (для UPDATE) или подставляет NULL по умолчанию (для INSERT).
 */
function filterNullish<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(
      ([, value]) => value !== undefined && value !== null,
    ),
  ) as Partial<T>;
}

// ============================================================
// PUBLIC TYPES
// ============================================================

/**
 * Распакованные сэмплы одного типа: интервал и массив значений.
 * Возвращается публичными методами чтения, где блоб уже разобран.
 */
export interface ParsedSample {
  intervalSec: number;
  values: number[];
}

/**
 * Сырой блоб одного типа: интервал и бинарные данные как есть.
 * Возвращается raw-методами, когда распаковка не нужна
 * (например, для base64-передачи фронту без промежуточного шага).
 */
export interface RawSample {
  intervalSec: number;
  samples: Buffer;
}

/**
 * Тренировка + все её сэмплы. Возвращается getSessionWithSamples.
 *
 * `samples` — Partial<Record<...>>: отсутствующие типы (провайдер
 * их не прислал) в объекте отсутствуют, а не равны null. Это
 * позволяет отличить «нет данных» от «данные пустые».
 */
export interface SessionWithSamples {
  session: TrainingSession;
  samples: Partial<Record<SampleType, ParsedSample>>;
}

/**
 * Входной набор сэмплов для saveSessionWithSamples.
 * Один элемент = один тип сэмпла одной тренировки.
 */
export interface SampleInput {
  sampleType: SampleType;
  intervalSec: number;
  values: number[];
}

@Injectable()
export class TrainingRepository {
  private readonly logger = new Logger(TrainingRepository.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  // SELECT SHAPES
  // ============================================================

  private readonly sessionShape = {
    userId: trainingSessions.userId,
    provider: trainingSessions.provider,
    externalId: trainingSessions.externalId,
    id: trainingSessions.id,
    startTime: trainingSessions.startTime,
    durationSec: trainingSessions.durationSec,
    sport: trainingSessions.sport,
    distanceM: trainingSessions.distanceM,
    calories: trainingSessions.calories,
    hrAvg: trainingSessions.hrAvg,
    hrMax: trainingSessions.hrMax,
    hrMin: trainingSessions.hrMin,
    ascentM: trainingSessions.ascentM,
    descentM: trainingSessions.descentM,
    name: trainingSessions.name,
    notes: trainingSessions.notes,
  } as const;

  // ============================================================
  // ERROR DETECTION
  // ============================================================
  //
  // Три формы проверки — как в test-grade.ydb.repository:
  //   1) типизированный класс;
  //   2) YDBError с кодом 400120;
  //   3) Error с cause = YDBError(400120).
  //
  private isDuplicateError(error: unknown): boolean {
    if (error instanceof YdbUniqueConstraintViolationError) return true;

    if (
      error instanceof YDBError &&
      (error.code as number) === YDB_UNIQUE_VIOLATION_CODE
    ) {
      return true;
    }

    if (
      error instanceof Error &&
      'cause' in error &&
      error.cause instanceof YDBError &&
      (error.cause.code as number) === YDB_UNIQUE_VIOLATION_CODE
    ) {
      return true;
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════════
  //  ПУБЛИЧНЫЕ МЕТОДЫ — сценарии агрегата
  // ═══════════════════════════════════════════════════════════

  // ============================================================
  // SAVE SESSION WITH SAMPLES
  // ============================================================
  //
  // Единственный метод для записи тренировки с сэмплами.
  // Используется и вебхуком, и backfill'ом, и admin-переобработкой.
  //
  // Идемпотентность:
  //   - training_sessions: PK (userId, provider, externalId) +
  //     детерминированный id. Повторный вызов обновляет ту же
  //     строку, а не создаёт дубликат.
  //   - training_samples: PK (sessionId, sampleType). Повторная
  //     запись перезаписывает блоб целиком.
  //   - Обе операции в одной транзакции с idempotent: true —
  //     либо всё записалось, либо ничего, и при гонке YDB
  //     перезапустит транзакцию.
  //
  // Семантика name/notes:
  //   Это поля пользователя Arbitrator, а не провайдера. Если
  //   переданы в data — записываются (обычно только при первом
  //   INSERT). Если нет — существующие значения сохраняются.
  //   Провайдер их не перезаписывает.
  //
  async saveSessionWithSamples(
    data: CreateTrainingSessionData,
    samples: SampleInput[],
  ): Promise<TrainingSession> {
    return this.db.transaction(
      async (tx) => {
        const session = await this.upsertSession(data, tx);
        await this.upsertSamples(session.id, samples, tx);
        return session;
      },
      { idempotent: true },
    );
  }

  // ============================================================
  // GET SESSION WITH SAMPLES
  // ============================================================
  //
  // Основной сценарий чтения для API: одна тренировка со всеми
  // сэмплами. Сначала ищем сессию по ключу, затем читаем все
  // её блобы одним запросом.
  //
  // Возвращает null, если тренировки нет.
  //
  async getSessionWithSamples(
    userId: string,
    provider: string,
    externalId: string,
  ): Promise<SessionWithSamples | null> {
    const session = await this.findSessionByKey(userId, provider, externalId);
    if (!session) return null;

    const samples = await this.findSamplesBySession(session.id);
    return { session, samples };
  }

  // ============================================================
  // FIND SESSIONS BY USER AND PERIOD
  // ============================================================
  //
  // Список тренировок пользователя за диапазон [from, to) — без
  // сэмплов. Сэмплы тянутся отдельно при открытии конкретной
  // тренировки (getSessionWithSamples).
  //
  // Идёт через глобальный индекс idx_start_time (user_id, start_time).
  // Сортировка: start_time DESC, id DESC как tie-breaker —
  // чтобы пагинация была стабильной при одинаковом start_time.
  //
  async findSessionsByUserAndPeriod(
    userId: string,
    from: Date,
    to: Date,
    limit = 100,
    offset = 0,
  ): Promise<TrainingSession[]> {
    return (await this.db
      .select()
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, userId),
          gte(trainingSessions.startTime, from),
          lt(trainingSessions.startTime, to),
        ),
      )
      .orderBy(desc(trainingSessions.startTime), desc(trainingSessions.id))
      .limit(limit)
      .offset(offset)) as TrainingSession[];
  }

  // ============================================================
  // COUNT SESSIONS BY USER AND PERIOD
  // ============================================================
  //
  // Отдельный метод для пагинации: клиенту нужен total.
  // Count не тащит сортировку и лимиты — планировщик YDB может
  // обработать его эффективнее.
  //
  async countSessionsByUserAndPeriod(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const rows = (await this.db
      .select({ count: sql<number>`count(*)` })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, userId),
          gte(trainingSessions.startTime, from),
          lt(trainingSessions.startTime, to),
        ),
      )) as { count: number }[];
    const [{ count }] = rows;
    return Number(count ?? 0);
  }

  // ============================================================
  // UPDATE USER FIELDS
  // ============================================================
  //
  // Обновляет поля, принадлежащие пользователю Arbitrator:
  // name, notes, sport. Провайдер сюда не пишет.
  //
  // Семантика:
  //   - undefined → «не трогать» (отсекается фильтром);
  //   - null      → «очистить» (уходит через nullsToSql → SQL NULL);
  //   - значение  → записать.
  //
  async updateUserFields(
    userId: string,
    provider: string,
    externalId: string,
    patch: UpdateTrainingSessionData,
  ): Promise<TrainingSession | null> {
    // Отсекаем undefined — «не передано» значит «не трогать».
    // null при этом остаётся и уходит в nullsToSql ниже.
    const defined = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );

    if (Object.keys(defined).length === 0) {
      return this.findSessionByKey(userId, provider, externalId);
    }

    const setData = nullsToSql(defined);

    const updated = (await this.db
      .update(trainingSessions)
      .set(setData)
      .where(
        and(
          eq(trainingSessions.userId, userId),
          eq(trainingSessions.provider, provider),
          eq(trainingSessions.externalId, externalId),
        ),
      )
      .returning(this.sessionShape)) as TrainingSession[];

    return updated[0] ?? null;
  }

  // ============================================================
  // DELETE SESSION
  // ============================================================
  //
  // Удаляет тренировку и все её сэмплы. Одна транзакция, чтобы
  // не оставить «висячих» сэмплов без родителя.
  //
  // Идемпотентно: повторный вызов вернёт false (тренировки нет).
  // Первый вызов возвращает true, если что-то удалили.
  //
  async deleteSession(
    userId: string,
    provider: string,
    externalId: string,
  ): Promise<boolean> {
    return this.db.transaction(
      async (tx) => {
        const session = await this.findSessionByKeyInternal(
          userId,
          provider,
          externalId,
          tx,
        );
        if (!session) return false;

        await this.deleteSamplesBySession(session.id, tx);
        await this.deleteSessionByKey(userId, provider, externalId, tx);
        return true;
      },
      { idempotent: true },
    );
  }

  // ============================================================
  // FIND SESSION BY KEY (public)
  // ============================================================
  //
  // Lookup по полному PK: (userId, provider, externalId).
  // Возвращает null, если сессии нет.
  //
  // Public, потому что используется сервисом напрямую (например,
  // в getRawSamples, чтобы не тянуть сэмплы ради их выброса).
  // Внутренние вызовы (внутри транзакций) идут через
  // findSessionByKeyInternal — чтобы работать в уже открытом tx,
  // а не открывать свой.
  //
  async findSessionByKey(
    userId: string,
    provider: string,
    externalId: string,
  ): Promise<TrainingSession | null> {
    return this.findSessionByKeyInternal(userId, provider, externalId, this.db);
  }

  // ============================================================
  // FIND SESSION BY ID (public — для внутренних нужд сервиса)
  // ============================================================
  //
  // Быстрый lookup по уникальному индексу idx_id. Основной сценарий —
  // когда известен session_id, но неизвестен полный ключ
  // (например, из вебхука пришёл только entity_id, и мы уже
  // вычислили хеш).
  //
  async findSessionById(id: string): Promise<TrainingSession | null> {
    return this.findSessionByIdInternal(id, this.db);
  }

  // ============================================================
  // FIND RAW SAMPLES BY SESSION (public — для base64-передачи)
  // ============================================================
  //
  // Возвращает блобы как есть, без распаковки. Используется,
  // когда фронт хочет получить base64-строку: избегаем шага
  // «распаковать → переупаковать в base64» на бэке.
  //
  async findRawSamplesBySession(
    sessionId: string,
  ): Promise<Partial<Record<SampleType, RawSample>>> {
    return this.findRawSamplesBySessionInternal(sessionId, this.db);
  }

  // ============================================================
  // FIND RAW SAMPLE BY TYPE (public — для отладки/admin)
  // ============================================================
  //
  // Сырой блоб одного типа. Полезно для admin-эндпоинтов: посмотреть,
  // сколько байт занимает hr-блоб, или скачать его в файл.
  //
  async findRawSampleByType(
    sessionId: string,
    sampleType: SampleType,
  ): Promise<RawSample | null> {
    const rows = (await this.db
      .select()
      .from(trainingSamples)
      .where(
        and(
          eq(trainingSamples.sessionId, sessionId),
          eq(trainingSamples.sampleType, sampleType),
        ),
      )
      .limit(1)) as TrainingSample[];

    const row = rows[0];
    if (!row) return null;

    return {
      intervalSec: row.intervalSec,
      samples: Buffer.from(row.samples),
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  ПРИВАТНЫЕ МЕТОДЫ — работа с отдельными таблицами
  // ═══════════════════════════════════════════════════════════
  //
  // Все вызываются только из публичных сценариев, всегда
  // внутри уже открытой транзакции (или через this.db для
  // read-only операций).
  //

  // ─── training_sessions ───────────────────────────────────

  private async upsertSession(
    data: CreateTrainingSessionData,
    runner: DrizzleRunner,
  ): Promise<TrainingSession> {
    const id = makeSessionId(data.userId, data.provider, data.externalId);

    // 1. Проверяем существование по PK.
    const existing = await this.findSessionByKeyInternal(
      data.userId,
      data.provider,
      data.externalId,
      runner,
    );

    if (existing) {
      // 2a. UPDATE — провайдерские поля. name/notes НЕ трогаем:
      //     это пользовательские поля, провайдер их не знает.
      const patch = filterNullish({
        startTime: data.startTime,
        durationSec: data.durationSec,
        sport: data.sport,
        distanceM: data.distanceM,
        calories: data.calories,
        hrAvg: data.hrAvg,
        hrMax: data.hrMax,
        hrMin: data.hrMin,
        ascentM: data.ascentM,
        descentM: data.descentM,
      });

      if (Object.keys(patch).length === 0) {
        // Нечего обновлять — только обязательные поля были
        // и те уже есть. Возвращаем текущее состояние.
        return existing;
      }

      const updated = (await runner
        .update(trainingSessions)
        .set(patch)
        .where(
          and(
            eq(trainingSessions.userId, data.userId),
            eq(trainingSessions.provider, data.provider),
            eq(trainingSessions.externalId, data.externalId),
          ),
        )
        .returning(this.sessionShape)) as TrainingSession[];

      const row = updated[0];
      if (!row) {
        throw new Error(
          `Failed to update training session ${id} — no row returned`,
        );
      }
      return row;
    }

    // 2b. INSERT — отсекаем undefined/null, чтобы YDB не получил
    //     protobuf null_type в bind-параметрах. name/notes
    //     передаются только если провайдер их дал.
    const insertData = filterNullish({
      userId: data.userId,
      provider: data.provider,
      externalId: data.externalId,
      id,
      startTime: data.startTime,
      durationSec: data.durationSec,
      sport: data.sport,
      distanceM: data.distanceM,
      calories: data.calories,
      hrAvg: data.hrAvg,
      hrMax: data.hrMax,
      hrMin: data.hrMin,
      ascentM: data.ascentM,
      descentM: data.descentM,
      name: data.name,
      notes: data.notes,
    });

    try {
      const inserted = (await runner
        .insert(trainingSessions)
        .values(insertData)
        .returning(this.sessionShape)) as TrainingSession[];

      const row = inserted[0];
      if (!row) {
        throw new Error(
          `Failed to insert training session ${id} — no row returned`,
        );
      }
      return row;
    } catch (err) {
      // 400120 здесь возможен только при гонке двух транзакций
      // (параллельная успела вставить строку между нашим SELECT
      // и INSERT). При idempotent:true YDB перезапустит
      // транзакцию, и следующий проход увидит existing.
      //
      // Если 400120 всё-таки всплыл — retry исчерпан, либо
      // (маловероятно) коллизия в makeSessionId. Это 500, не 409:
      // клиент не присылал дубликат, поэтому маскировать под
      // «уже существует» нельзя. Логируем и пробрасываем.
      if (this.isDuplicateError(err)) {
        this.logger.error(
          `upsertSession hit 400120 after retries | ` +
            `(user=${data.userId}, provider=${data.provider}, ` +
            `external=${data.externalId}). ` +
            `This is not a user error — investigate.`,
        );
      }
      throw err;
    }
  }

  private async findSessionByKeyInternal(
    userId: string,
    provider: string,
    externalId: string,
    runner: DrizzleRunner,
  ): Promise<TrainingSession | null> {
    const rows = (await runner
      .select()
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, userId),
          eq(trainingSessions.provider, provider),
          eq(trainingSessions.externalId, externalId),
        ),
      )
      .limit(1)) as TrainingSession[];
    return rows[0] ?? null;
  }

  private async findSessionByIdInternal(
    id: string,
    runner: DrizzleRunner,
  ): Promise<TrainingSession | null> {
    const rows = (await runner
      .select()
      .from(trainingSessions)
      .where(eq(trainingSessions.id, id))
      .limit(1)) as TrainingSession[];
    return rows[0] ?? null;
  }

  private async deleteSessionByKey(
    userId: string,
    provider: string,
    externalId: string,
    runner: DrizzleRunner,
  ): Promise<TrainingSession | null> {
    const rows = (await runner
      .delete(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, userId),
          eq(trainingSessions.provider, provider),
          eq(trainingSessions.externalId, externalId),
        ),
      )
      .returning(this.sessionShape)) as TrainingSession[];
    return rows[0] ?? null;
  }

  // ─── training_samples ────────────────────────────────────

  private async upsertSamples(
    sessionId: string,
    samples: SampleInput[],
    runner: DrizzleRunner,
  ): Promise<number> {
    // Отсекаем пустые наборы: пустой блоб в БД бессмысленен.
    const nonEmpty = samples.filter((s) => s.values.length > 0);

    if (nonEmpty.length === 0) return 0;

    let written = 0;

    for (const s of nonEmpty) {
      const blob = packSamples(s.sampleType, s.values);

      // SELECT-или-UPDATE-или-INSERT внутри уже открытой транзакции.
      // При повторном вызове с теми же данными каждая итерация
      // уйдёт в UPDATE, при первом — в INSERT.
      const existing = (await runner
        .select({ sessionId: trainingSamples.sessionId })
        .from(trainingSamples)
        .where(
          and(
            eq(trainingSamples.sessionId, sessionId),
            eq(trainingSamples.sampleType, s.sampleType),
          ),
        )
        .limit(1)) as { sessionId: string }[];

      if (existing.length > 0) {
        await runner
          .update(trainingSamples)
          .set({
            intervalSec: s.intervalSec,
            samples: blob,
          })
          .where(
            and(
              eq(trainingSamples.sessionId, sessionId),
              eq(trainingSamples.sampleType, s.sampleType),
            ),
          );
      } else {
        await runner.insert(trainingSamples).values({
          sessionId,
          sampleType: s.sampleType,
          intervalSec: s.intervalSec,
          samples: blob,
        });
      }

      written++;
    }

    return written;
  }

  private async findSamplesBySession(
    sessionId: string,
    runner: DrizzleRunner = this.db,
  ): Promise<Partial<Record<SampleType, ParsedSample>>> {
    const rows = (await runner
      .select()
      .from(trainingSamples)
      .where(eq(trainingSamples.sessionId, sessionId))
      .orderBy(asc(trainingSamples.sampleType))) as TrainingSample[];

    const result: Partial<Record<SampleType, ParsedSample>> = {};
    for (const row of rows) {
      const type = row.sampleType;
      const values = unpackSamples(type, Buffer.from(row.samples));
      result[type] = {
        intervalSec: row.intervalSec,
        values,
      };
    }
    return result;
  }

  private async findRawSamplesBySessionInternal(
    sessionId: string,
    runner: DrizzleRunner,
  ): Promise<Partial<Record<SampleType, RawSample>>> {
    const rows = (await runner
      .select()
      .from(trainingSamples)
      .where(eq(trainingSamples.sessionId, sessionId))
      .orderBy(asc(trainingSamples.sampleType))) as TrainingSample[];

    const result: Partial<Record<SampleType, RawSample>> = {};
    for (const row of rows) {
      const type = row.sampleType;
      result[type] = {
        intervalSec: row.intervalSec,
        samples: Buffer.from(row.samples),
      };
    }
    return result;
  }

  private async deleteSamplesBySession(
    sessionId: string,
    runner: DrizzleRunner,
  ): Promise<number> {
    const deleted = (await runner
      .delete(trainingSamples)
      .where(eq(trainingSamples.sessionId, sessionId))
      .returning({ sampleType: trainingSamples.sampleType })) as {
      sampleType: string;
    }[];
    return deleted.length;
  }
}
