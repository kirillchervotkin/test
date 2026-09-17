// src/results/repository/result.ydb.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql, asc, desc, inArray, SQL } from 'drizzle-orm';
import type { YdbDrizzleDatabase } from '@ydbjs/drizzle-adapter';
import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { results } from '../entities/result.schema.js';
import { resultTestTypes } from '../../result-test-types/entities/result-test-type.schema.js';
import { trainingCamps } from '../../training_camp/entities/training-camp.schema.js';
import { users } from '../../user/entities/user.schema.js';
import {
  Result,
  CreateResultData,
  UpdateResultData,
  ResultStatus,
} from '../entities/types/result.types.js';

type DrizzleDb = YdbDrizzleDatabase;
type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];

/** Связь result ↔ test type (строка из result_test_types). */
export interface ResultTestTypeLink {
  resultId: string;
  testTypeId: string;
}

const resultReturning = {
  id: results.id,
  userId: results.userId,
  trainingCampId: results.trainingCampId,
  isTen: results.isTen,
  legNumber: results.legNumber,
  status: results.status,
  time: results.time,
  level: results.level,
  segments: results.segments,
} as const;

/**
 * Для каждого поля типа `T[K]` возвращает `Exclude<T[K], null> | SQL`.
 * Именно такой формы Drizzle ждёт значения в `.values()` / `.set()`.
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

/** То же самое, но для массива объектов (bulk insert / upsert). */
function nullsToSqlArray<T extends object>(
  arr: T[],
): { [K in keyof T]: SqlOrValue<T[K]> }[] {
  return arr.map((item) => nullsToSql(item));
}

@Injectable()
export class ResultYdbRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  // CREATE SINGLE
  //
  // ⚠️ YDB не принимает JS-`null` в bind-параметрах: драйвер
  // сериализует его как protobuf `null_type: NULL_VALUE`, и
  // запрос падает с GENERIC_ERROR. Поэтому перед `.values(...)`
  // прогоняем объект через nullsToSql — каждое `null`-значение
  // превращается в SQL-литерал `NULL` (идёт в текст запроса,
  // а не в `$pN`).
  // ============================================================
  async create(data: CreateResultData, tx?: DrizzleTx): Promise<Result> {
    const runner = tx ?? this.db;
    const id = uuidv4();
    const insertData = nullsToSql({ id, ...data });

    const result = (await runner
      .insert(results)
      .values(insertData)
      .returning(resultReturning)) as Result[];

    const [newResult] = result;
    if (!newResult) throw new Error('Failed to create result');
    return newResult;
  }

  // ============================================================
  // BULK CREATE
  // ============================================================
  async createBulk(
    data: CreateResultData[],
    tx?: DrizzleTx,
  ): Promise<Result[]> {
    if (data.length === 0) return [];

    const runner = tx ?? this.db;
    const insertData = nullsToSqlArray(
      data.map((item) => ({ ...item, id: uuidv4() })),
    );

    return (await runner
      .insert(results)
      .values(insertData)
      .returning(resultReturning)) as Result[];
  }

  // ============================================================
  // FIND BY ID
  // ============================================================
  async findById(id: string, tx?: DrizzleTx): Promise<Result | null> {
    const runner = tx ?? this.db;
    const result = (await runner
      .select()
      .from(results)
      .where(eq(results.id, id))
      .limit(1)) as Result[];
    return result[0] || null;
  }

  // ============================================================
  // FIND ALL BY COMPOSITE KEY
  //
  // В одном слоте (user, camp, is_10m, leg) теперь может быть
  // НЕСКОЛЬКО строк results — по одной на каждый «набор типов
  // тестов». Поэтому возвращаем массив, а не один результат.
  // ============================================================
  async findAllByComposite(
    userId: string,
    trainingCampId: string,
    isTen: boolean,
    legNumber: number,
    tx?: DrizzleTx,
  ): Promise<Result[]> {
    const runner = tx ?? this.db;
    const rows = (await runner
      .select()
      .from(results)
      .where(
        and(
          eq(results.userId, userId),
          eq(results.trainingCampId, trainingCampId),
          eq(results.isTen, isTen),
          eq(results.legNumber, legNumber),
        ),
      )) as Result[];
    return rows;
  }

  // ============================================================
  // UPDATE BY ID (частичное)
  //
  // `null` в fields осмыслен (сбросить поле), но нельзя отдавать
  // его драйверу как bind-параметр — см. create(). nullsToSql
  // превращает null в SQL-литерал NULL.
  // ============================================================
  async updateById(
    id: string,
    data: Partial<UpdateResultData>,
    tx?: DrizzleTx,
  ): Promise<Result | null> {
    const runner = tx ?? this.db;
    const { id: _, ...fields } = data as UpdateResultData;
    if (Object.keys(fields).length === 0) return this.findById(id, tx);

    const setData = nullsToSql(fields);

    const result = (await runner
      .update(results)
      .set(setData)
      .where(eq(results.id, id))
      .returning(resultReturning)) as Result[];
    return result[0] || null;
  }

  // ============================================================
  // DELETE BY ID
  // ============================================================
  async deleteById(id: string, tx?: DrizzleTx): Promise<Result | null> {
    const runner = tx ?? this.db;
    const result = (await runner
      .delete(results)
      .where(eq(results.id, id))
      .returning(resultReturning)) as Result[];
    return result[0] || null;
  }

  // ============================================================
  // DELETE ALL BY USER AND CAMP
  // ============================================================
  async deleteAllByUserAndCamp(
    userId: string,
    trainingCampId: string,
    tx?: DrizzleTx,
  ): Promise<void> {
    const runner = tx ?? this.db;
    await runner
      .delete(results)
      .where(
        and(
          eq(results.userId, userId),
          eq(results.trainingCampId, trainingCampId),
        ),
      );
  }

  // ============================================================
  // FIND ALL FOR USER IN CAMP
  // ============================================================
  async findAllByUserAndCamp(
    userId: string,
    trainingCampId: string,
    tx?: DrizzleTx,
  ): Promise<Result[]> {
    const runner = tx ?? this.db;
    const rows = (await runner
      .select()
      .from(results)
      .where(
        and(
          eq(results.userId, userId),
          eq(results.trainingCampId, trainingCampId),
        ),
      )
      .orderBy(
        asc(results.isTen),
        asc(results.legNumber),
        asc(results.id),
      )) as Result[];
    return rows;
  }

  // ============================================================
  // FIND ALL BY USER, CAMP AND TEST TYPE (через JOIN)
  // ============================================================
  async findAllByUserAndCampAndTestType(
    userId: string,
    trainingCampId: string,
    testTypeId: string,
    tx?: DrizzleTx,
  ): Promise<Result[]> {
    const runner = tx ?? this.db;
    const rows = (await runner
      .select({ result: results })
      .from(results)
      .innerJoin(resultTestTypes, eq(results.id, resultTestTypes.resultId))
      .where(
        and(
          eq(results.userId, userId),
          eq(results.trainingCampId, trainingCampId),
          eq(resultTestTypes.testTypeId, testTypeId),
        ),
      )
      .orderBy(
        asc(results.isTen),
        asc(results.legNumber),
        asc(results.id),
      )) as {
      result: Result;
    }[];

    return rows.map((r) => r.result);
  }

  // ============================================================
  // FIND ALL WITH FILTERS
  // ============================================================
  async findAll(
    limit = 100,
    offset = 0,
    filter?: {
      userId?: string;
      trainingCampId?: string;
      isTen?: boolean;
      legNumber?: number;
      testTypeId?: string;
      status?: ResultStatus;
    },
    orderBy: 'time' | 'legNumber' = 'time',
    orderDir: 'ASC' | 'DESC' = 'DESC',
    tx?: DrizzleTx,
  ): Promise<{ rows: Result[]; total: number }> {
    const runner = tx ?? this.db;

    const orderFieldMap = {
      time: results.time,
      legNumber: results.legNumber,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.userId) conditions.push(eq(results.userId, filter.userId));
    if (filter?.trainingCampId)
      conditions.push(eq(results.trainingCampId, filter.trainingCampId));
    if (filter?.isTen !== undefined)
      conditions.push(eq(results.isTen, filter.isTen));
    if (filter?.legNumber !== undefined)
      conditions.push(eq(results.legNumber, filter.legNumber));
    if (filter?.status) conditions.push(eq(results.status, filter.status));

    const baseWhere = conditions.length ? and(...conditions) : undefined;

    if (filter?.testTypeId) {
      const joinCondition = eq(results.id, resultTestTypes.resultId);
      const joinWhere = and(
        eq(resultTestTypes.testTypeId, filter.testTypeId),
        baseWhere,
      );

      const rows = (await runner
        .select({ result: results })
        .from(results)
        .innerJoin(resultTestTypes, joinCondition)
        .where(joinWhere)
        .orderBy(
          orderDir === 'ASC' ? asc(orderField) : desc(orderField),
          orderDir === 'ASC' ? asc(results.legNumber) : desc(results.legNumber),
          asc(results.id),
        )
        .limit(limit)
        .offset(offset)) as { result: Result }[];

      const countResult = (await runner
        .select({ count: sql<number>`count(*)` })
        .from(results)
        .innerJoin(resultTestTypes, joinCondition)
        .where(joinWhere)) as { count: number }[];

      const [{ count }] = countResult;
      return {
        rows: rows.map((r) => r.result),
        total: Number(count ?? 0),
      };
    }

    const rows = (await runner
      .select()
      .from(results)
      .where(baseWhere)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(results.legNumber) : desc(results.legNumber),
        asc(results.id),
      )
      .limit(limit)
      .offset(offset)) as Result[];

    const countResult = (await runner
      .select({ count: sql<number>`count(*)` })
      .from(results)
      .where(baseWhere)) as { count: number }[];

    const [{ count }] = countResult;
    return { rows, total: Number(count ?? 0) };
  }

  // ============================================================
  // LINKS: result_test_types
  // ============================================================

  /** Связи для одного результата. */
  async findLinksByResultId(
    resultId: string,
    tx?: DrizzleTx,
  ): Promise<ResultTestTypeLink[]> {
    const runner = tx ?? this.db;
    return (await runner
      .select({
        resultId: resultTestTypes.resultId,
        testTypeId: resultTestTypes.testTypeId,
      })
      .from(resultTestTypes)
      .where(eq(resultTestTypes.resultId, resultId))) as ResultTestTypeLink[];
  }

  /** Связи сразу для пачки результатов (для батч-DTO без N+1). */
  async findLinksByResultIds(
    resultIds: string[],
    tx?: DrizzleTx,
  ): Promise<ResultTestTypeLink[]> {
    if (resultIds.length === 0) return [];
    const runner = tx ?? this.db;
    return (await runner
      .select({
        resultId: resultTestTypes.resultId,
        testTypeId: resultTestTypes.testTypeId,
      })
      .from(resultTestTypes)
      .where(
        inArray(resultTestTypes.resultId, resultIds),
      )) as ResultTestTypeLink[];
  }

  /** Привязать набор типов тестов к результату. */
  async attachTestTypes(
    resultId: string,
    testTypeIds: string[],
    tx?: DrizzleTx,
  ): Promise<void> {
    if (testTypeIds.length === 0) return;
    const runner = tx ?? this.db;
    await runner
      .insert(resultTestTypes)
      .values(
        testTypeIds.map((testTypeId) => ({
          resultId,
          testTypeId,
        })),
      )
      .execute();
  }

  /** Удалить все связи результата. */
  async deleteLinksByResultId(resultId: string, tx?: DrizzleTx): Promise<void> {
    const runner = tx ?? this.db;
    await runner
      .delete(resultTestTypes)
      .where(eq(resultTestTypes.resultId, resultId));
  }

  // ============================================================
  // HIGH-LEVEL OPERATIONS WITH TEST TYPES
  //
  // В одном слоте (user, camp, is_10m, leg) теперь может быть
  // несколько строк results, каждая со своим набором типов
  // тестов в result_test_types.
  //
  // Правило соответствия «строка results ↔ набор testTypeIds»
  // при upsert'е:
  //   1. Ищем в слоте существующую строку, у которой пересекается
  //      набор testTypeIds с сохраняемым.
  //   2. Нашли → обновляем её метрики и перепривязываем связи.
  //   3. Не нашли → создаём новую строку с новым id.
  // ============================================================

  /**
   * Создание одного результата с привязкой типов тестов.
   */
  async createWithTestTypes(
    data: CreateResultData,
    testTypeIds: string[],
  ): Promise<Result> {
    return this.db.transaction(
      async (tx) => {
        const created = await this.create(data, tx);
        await this.attachTestTypes(created.id, testTypeIds, tx);
        return created;
      },
      { idempotent: true },
    );
  }

  /**
   * Пакетное создание результатов с привязкой типов тестов.
   */
  async createBulkWithTestTypes(
    data: CreateResultData[],
    testTypeIds: string[],
  ): Promise<Result[]> {
    if (data.length === 0) return [];

    return this.db.transaction(
      async (tx) => {
        const created = await this.createBulk(data, tx);
        for (const result of created) {
          await this.attachTestTypes(result.id, testTypeIds, tx);
        }
        return created;
      },
      { idempotent: true },
    );
  }

  /**
   * Массовый upsert результатов с привязкой типов тестов.
   *
   * YDB upsert работает только по PK. PK теперь включает id,
   * поэтому просто вызвать upsert нельзя — мы не знаем id
   * заранее. Логика:
   *
   *   1. Для каждого item ищем в слоте существующий результат,
   *      у которого есть пересечение по testTypeIds с новым набором.
   *   2. Нашли → UPDATE этого результата + перепривязка связей.
   *   3. Не нашли → INSERT новой строки + привязка связей.
   *
   * Всё в одной транзакции: либо все items применились, либо
   * ни один.
   */
  async uploadResultsWithTestTypes(
    campId: string,
    data: CreateResultData[],
    testTypeIds: string[],
  ): Promise<Result[]> {
    if (data.length === 0) return [];

    return this.db.transaction(
      async (tx) => {
        // Проверка лагеря и пользователей — один раз на всю пачку.
        const camp = (await tx
          .select({ id: trainingCamps.id })
          .from(trainingCamps)
          .where(eq(trainingCamps.id, campId))
          .limit(1)) as { id: string }[];
        if (!camp || camp.length === 0) {
          throw new Error(`Training camp with id ${campId} not found`);
        }

        const userIds = [...new Set(data.map((item) => item.userId))];
        if (userIds.length > 0) {
          const existingUsers = (await tx
            .select({ id: users.id })
            .from(users)
            .where(inArray(users.id, userIds))) as { id: string }[];
          const existingIds = new Set(existingUsers.map((u) => u.id));
          const missingIds = userIds.filter((id) => !existingIds.has(id));
          if (missingIds.length > 0) {
            throw new Error(
              `Users with ids ${missingIds.join(', ')} not found`,
            );
          }
        }

        const saved: Result[] = [];

        for (const item of data) {
          // 1. Все существующие результаты в этом слоте.
          const existing = await this.findAllByComposite(
            item.userId,
            item.trainingCampId,
            item.isTen,
            item.legNumber,
            tx,
          );

          // 2. Ищем тот, у которого пересекается набор testTypeIds.
          let target: Result | null = null;
          for (const r of existing) {
            const links = await this.findLinksByResultId(r.id, tx);
            const linkIds = links.map((l) => l.testTypeId);
            if (testTypeIds.some((id) => linkIds.includes(id))) {
              target = r;
              break;
            }
          }

          if (target) {
            // 3a. Обновляем метрики и перепривязываем связи.
            const updated = await this.updateById(
              target.id,
              {
                status: item.status,
                time: item.time,
                level: item.level,
                segments: item.segments,
              },
              tx,
            );
            await this.deleteLinksByResultId(target.id, tx);
            await this.attachTestTypes(target.id, testTypeIds, tx);
            saved.push(updated ?? target);
          } else {
            // 3b. Новая строка.
            const created = await this.create(item, tx);
            await this.attachTestTypes(created.id, testTypeIds, tx);
            saved.push(created);
          }
        }

        return saved;
      },
      { idempotent: true },
    );
  }

  /**
   * Удаление результата по id вместе с его связями.
   * Возвращает удалённый результат или null.
   */
  async deleteResultById(id: string): Promise<Result | null> {
    return this.db.transaction(
      async (tx) => {
        const deleted = await this.deleteById(id, tx);
        if (!deleted) return null;
        await this.deleteLinksByResultId(id, tx);
        return deleted;
      },
      { idempotent: true },
    );
  }

  /**
   * Удаление ВСЕХ результатов в слоте вместе со связями.
   * Используется, когда нужно вычистить слот целиком, независимо
   * от того, сколько типов тестов к нему привязано.
   */
  async deleteAllResultsByComposite(
    userId: string,
    trainingCampId: string,
    isTen: boolean,
    legNumber: number,
  ): Promise<Result[]> {
    return this.db.transaction(
      async (tx) => {
        const existing = await this.findAllByComposite(
          userId,
          trainingCampId,
          isTen,
          legNumber,
          tx,
        );
        if (existing.length === 0) return [];

        for (const result of existing) {
          await this.deleteLinksByResultId(result.id, tx);
          await this.deleteById(result.id, tx);
        }
        return existing;
      },
      { idempotent: true },
    );
  }

  /**
   * Удаление всех результатов пользователя в лагере вместе со связями.
   */
  async deleteAllResultsByUserAndCamp(
    userId: string,
    trainingCampId: string,
  ): Promise<void> {
    return this.db.transaction(
      async (tx) => {
        const existing = await this.findAllByUserAndCamp(
          userId,
          trainingCampId,
          tx,
        );
        for (const result of existing) {
          await this.deleteLinksByResultId(result.id, tx);
        }
        await this.deleteAllByUserAndCamp(userId, trainingCampId, tx);
      },
      { idempotent: true },
    );
  }

  /**
   * Удаление всех результатов пользователя в лагере,
   * привязанных к указанному типу теста.
   */
  async deleteAllResultsByUserAndCampAndTestType(
    userId: string,
    trainingCampId: string,
    testTypeId: string,
  ): Promise<void> {
    return this.db.transaction(
      async (tx) => {
        const toDelete = await this.findAllByUserAndCampAndTestType(
          userId,
          trainingCampId,
          testTypeId,
          tx,
        );
        if (toDelete.length === 0) return;

        for (const result of toDelete) {
          await this.deleteLinksByResultId(result.id, tx);
        }
        for (const result of toDelete) {
          await this.deleteById(result.id, tx);
        }
      },
      { idempotent: true },
    );
  }
}
