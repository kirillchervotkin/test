// src/result-test-types/repository/result-test-type.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { YdbDrizzleDatabase } from '@ydbjs/drizzle-adapter';
import { YdbUniqueConstraintViolationError } from '@ydbjs/drizzle-adapter';
import { YDBError } from '@ydbjs/error';
import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../../common/exceptions/db-foreign-key-violation.exception.js';
import { resultTestTypes } from '../entities/result-test-type.schema.js';
import { testTypes } from '../../test-type/entities/test-type.schema.js';
import { ResultTestType } from '../entities/types/result-test-type.types.js';

type DrizzleDb = YdbDrizzleDatabase;
type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];

@Injectable()
export class ResultTestTypeRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  // ATTACH TEST TYPES – привязывает к ОДНОМУ результату один или
  // несколько типов теста.
  //
  // Обёртка над attachTestTypesBulk — используется контроллером
  // POST /results/:resultId/test-types.
  // ============================================================
  async attachTestTypes(
    resultId: string,
    testTypeIds: string[],
    tx?: DrizzleTx,
  ): Promise<ResultTestType[]> {
    if (testTypeIds.length === 0) return [];

    const uniqueIds = [...new Set(testTypeIds)];
    const pairs = uniqueIds.map((testTypeId) => ({ resultId, testTypeId }));

    return this.attachTestTypesBulk(pairs, tx);
  }

  // ============================================================
  // ATTACH TEST TYPES BULK – привязывает множество пар
  // (resultId, testTypeId) за ОДИН SELECT (проверка FK) и
  // ОДИН INSERT.
  //
  // Используется в ResultService.createBulk / uploadResults,
  // чтобы не делать SQL-запросы в цикле.
  // ============================================================
  async attachTestTypesBulk(
    pairs: { resultId: string; testTypeId: string }[],
    tx?: DrizzleTx,
  ): Promise<ResultTestType[]> {
    if (pairs.length === 0) return [];

    // Уникализируем пары — на случай дубликатов в массиве.
    const uniqueMap = new Map<
      string,
      { resultId: string; testTypeId: string }
    >();
    for (const pair of pairs) {
      const key = `${pair.resultId}|${pair.testTypeId}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, pair);
    }
    const uniquePairs = [...uniqueMap.values()];

    const runner = tx ?? this.db;

    // 1. Проверяем существование всех типов тестов — ОДИН SELECT
    const uniqueTestTypeIds = [
      ...new Set(uniquePairs.map((p) => p.testTypeId)),
    ];
    const found = (await runner
      .select({ id: testTypes.id })
      .from(testTypes)
      .where(inArray(testTypes.id, uniqueTestTypeIds))) as { id: string }[];

    const foundIds = new Set(found.map((t) => t.id));
    const missingIds = uniqueTestTypeIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      throw new DbForeignKeyViolationException(
        missingIds.map((id) => ({
          dbField: 'test_type_id',
          value: id,
        })),
        'fk_result_test_types_test_type',
      );
    }

    // 2. ОДИН INSERT на все пары
    try {
      return (await runner
        .insert(resultTestTypes)
        .values(uniquePairs)
        .returning({
          resultId: resultTestTypes.resultId,
          testTypeId: resultTestTypes.testTypeId,
        })) as ResultTestType[];
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          {
            dbField: 'result_id + test_type_id',
            value: `one or more pairs (${uniquePairs.length} total)`,
          },
        ]);
      }
      throw error;
    }
  }

  // ============================================================
  // FIND BY RESULT ID – все типы тестов, привязанные к результату
  // ============================================================
  async findByResultId(
    resultId: string,
    tx?: DrizzleTx,
  ): Promise<ResultTestType[]> {
    const runner = tx ?? this.db;
    return (await runner
      .select()
      .from(resultTestTypes)
      .where(eq(resultTestTypes.resultId, resultId))) as ResultTestType[];
  }

  // ============================================================
  // FIND BY RESULT IDS – пакетная выборка для списков (убирает N+1)
  // ============================================================
  async findByResultIds(
    resultIds: string[],
    tx?: DrizzleTx,
  ): Promise<ResultTestType[]> {
    if (resultIds.length === 0) return [];
    const runner = tx ?? this.db;

    return (await runner
      .select()
      .from(resultTestTypes)
      .where(inArray(resultTestTypes.resultId, resultIds))) as ResultTestType[];
  }

  // ============================================================
  // EXISTS BY TEST TYPE ID – используется при удалении test_type
  // для ручной проверки FK (YDB не поддерживает FK на уровне БД)
  // ============================================================
  async existsByTestTypeId(
    testTypeId: string,
    tx?: DrizzleTx,
  ): Promise<boolean> {
    const runner = tx ?? this.db;
    const result = (await runner
      .select({ resultId: resultTestTypes.resultId })
      .from(resultTestTypes)
      .where(eq(resultTestTypes.testTypeId, testTypeId))
      .limit(1)) as { resultId: string }[];

    return result.length > 0;
  }

  // ============================================================
  // DELETE BY RESULT ID – каскадное удаление связей ОДНОГО результата
  // ============================================================
  async deleteByResultId(
    resultId: string,
    tx?: DrizzleTx,
  ): Promise<ResultTestType[]> {
    const runner = tx ?? this.db;
    return (await runner
      .delete(resultTestTypes)
      .where(eq(resultTestTypes.resultId, resultId))
      .returning({
        resultId: resultTestTypes.resultId,
        testTypeId: resultTestTypes.testTypeId,
      })) as ResultTestType[];
  }

  // ============================================================
  // DELETE BY RESULT IDS – каскадное удаление связей для МНОЖЕСТВА
  // результатов одним запросом. Используется в uploadResults,
  // чтобы не делать DELETE в цикле.
  // ============================================================
  async deleteByResultIds(resultIds: string[], tx?: DrizzleTx): Promise<void> {
    if (resultIds.length === 0) return;
    const runner = tx ?? this.db;

    await runner
      .delete(resultTestTypes)
      .where(inArray(resultTestTypes.resultId, resultIds));
  }

  // ============================================================
  // ОБРАБОТКА ОШИБОК УНИКАЛЬНОСТИ
  // ============================================================
  private isDuplicateError(error: unknown): boolean {
    if (error instanceof YdbUniqueConstraintViolationError) return true;
    if (error instanceof YDBError && (error.code as number) === 400120)
      return true;
    if (
      error instanceof Error &&
      'cause' in error &&
      error.cause instanceof YDBError &&
      (error.cause.code as number) === 400120
    ) {
      return true;
    }
    return false;
  }
}
