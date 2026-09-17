// src/result-test-types/result-test-type.service.ts

import { Injectable, Inject } from '@nestjs/common';
import type { YdbDrizzleDatabase } from '@ydbjs/drizzle-adapter';
import { DRIZZLE } from '../common/ydb/ydb.constants.js';
import { ResultTestTypeRepository } from './repository/result-test-type.repository.js';
import { ResultTestType } from './entities/types/result-test-type.types.js';

@Injectable()
export class ResultTestTypeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: YdbDrizzleDatabase,
    private readonly repository: ResultTestTypeRepository,
  ) {}

  /**
   * Привязка одного или нескольких типов тестов к результату.
   * Для женских результатов обычно два типа: женский (родной) и мужской
   * (для сравнения).
   *
   * Открывает idempotent-транзакцию: проверка FK и вставка выполняются
   * атомарно, при конфликте YDB автоматически повторит всю операцию.
   *
   * Используется в POST /results/:resultId/test-types.
   */
  attachTestTypes(
    resultId: string,
    testTypeIds: string[],
  ): Promise<ResultTestType[]> {
    if (testTypeIds.length === 0) return Promise.resolve([]);

    return this.db.transaction(
      (tx) => this.repository.attachTestTypes(resultId, testTypeIds, tx),
      { idempotent: true },
    );
  }

  /**
   * Получение всех типов тестов, привязанных к результату.
   * Используется в GET /results/:resultId/test-types.
   */
  findByResultId(resultId: string): Promise<ResultTestType[]> {
    return this.repository.findByResultId(resultId);
  }
}
