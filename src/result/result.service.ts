// src/results/result.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Result,
  CreateResultData,
  UpdateResultData,
  ResultStatus,
  ResultWithLinks,
} from './entities/types/result.types.js';
import { ResultYdbRepository } from './repository/result.repository.js';

@Injectable()
export class ResultService {
  constructor(private readonly repository: ResultYdbRepository) {}

  // ============================================================
  // ВНУТРЕННЯЯ БИЗНЕС-ВАЛИДАЦИЯ
  //
  // В сервисе остаётся только та проверка, которую НЕ может
  // сделать DTO: «completed требует метрику В ИТОГЕ после PATCH».
  //
  // Проверка «not_admitted не должен иметь метрик» уже сделана
  // в CreateResultItemDto через @IsResultStatusConsistent и
  // повторять её здесь не нужно.
  // ============================================================

  private assertCompletedHasMetric(
    status: ResultStatus,
    metrics: {
      time: number | null;
      level: number | null;
      segments: number | null;
    },
  ): void {
    if (status !== 'completed') return;

    const hasAnyMetric =
      metrics.time != null || metrics.level != null || metrics.segments != null;

    if (!hasAnyMetric) {
      throw new BadRequestException(
        'completed result must have at least one metric (time | level | segments)',
      );
    }
  }

  /**
   * Склеивает массив результатов с их связями из result_test_types
   * через батч-запрос (без N+1).
   */
  private async attachLinks(results: Result[]): Promise<ResultWithLinks[]> {
    if (results.length === 0) return [];

    const links = await this.repository.findLinksByResultIds(
      results.map((r) => r.id),
    );
    const map = new Map<string, string[]>();
    for (const link of links) {
      const list = map.get(link.resultId) ?? [];
      list.push(link.testTypeId);
      map.set(link.resultId, list);
    }
    return results.map((result) => ({
      result,
      testTypeIds: map.get(result.id) ?? [],
    }));
  }

  // ============================================================
  // CREATE (одиночный)
  //
  // Валидация status ↔ метрики выполняется в DTO (CreateResultItemDto).
  // Транзакция — в репозитории.
  // ============================================================
  async create(
    data: CreateResultData,
    testTypeIds: string[],
  ): Promise<ResultWithLinks> {
    const result = await this.repository.createWithTestTypes(data, testTypeIds);
    return { result, testTypeIds };
  }

  // ============================================================
  // CREATE BULK
  // ============================================================
  async createBulk(
    data: CreateResultData[],
    testTypeIds: string[],
  ): Promise<ResultWithLinks[]> {
    if (data.length === 0) return [];

    const created = await this.repository.createBulkWithTestTypes(
      data,
      testTypeIds,
    );
    return created.map((result) => ({ result, testTypeIds }));
  }

  // ============================================================
  // UPLOAD (массовый upsert для одного пользователя / сбора)
  //
  // Логика «найти результат в слоте с пересекающимся набором
  // testTypeIds → обновить; иначе создать новый» инкапсулирована
  // в repository.uploadResultsWithTestTypes.
  // ============================================================
  async uploadResults(
    campId: string,
    data: CreateResultData[],
    testTypeIds: string[],
  ): Promise<ResultWithLinks[]> {
    const saved = await this.repository.uploadResultsWithTestTypes(
      campId,
      data,
      testTypeIds,
    );
    return saved.map((result) => ({ result, testTypeIds }));
  }

  // ============================================================
  // READ
  // ============================================================

  async findById(id: string): Promise<ResultWithLinks | null> {
    const result = await this.repository.findById(id);
    if (!result) return null;

    const links = await this.repository.findLinksByResultId(id);
    return {
      result,
      testTypeIds: links.map((l) => l.testTypeId),
    };
  }

  /**
   * Все результаты в одном слоте (user, camp, is_10m, leg).
   *
   * В отличие от старого `findByComposite`, возвращает МАССИВ:
   * в одном слоте может быть несколько строк results — по одной
   * на каждый уникальный набор типов тестов.
   */
  async findAllByComposite(
    userId: string,
    trainingCampId: string,
    isTen: boolean,
    legNumber: number,
  ): Promise<ResultWithLinks[]> {
    const results = await this.repository.findAllByComposite(
      userId,
      trainingCampId,
      isTen,
      legNumber,
    );
    return this.attachLinks(results);
  }

  async findAllByUserAndCamp(
    userId: string,
    trainingCampId: string,
  ): Promise<ResultWithLinks[]> {
    const results = await this.repository.findAllByUserAndCamp(
      userId,
      trainingCampId,
    );
    return this.attachLinks(results);
  }

  async findAll(params: {
    limit?: number;
    offset?: number;
    filter?: {
      userId?: string;
      trainingCampId?: string;
      isTen?: boolean;
      legNumber?: number;
      testTypeId?: string;
      status?: ResultStatus;
    };
    orderBy?: 'time' | 'legNumber';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<{ rows: ResultWithLinks[]; total: number }> {
    const { rows, total } = await this.repository.findAll(
      params.limit ?? 100,
      params.offset ?? 0,
      params.filter,
      params.orderBy ?? 'time',
      params.orderDir ?? 'DESC',
    );

    const withLinks = await this.attachLinks(rows);
    return { rows: withLinks, total };
  }

  // ============================================================
  // UPDATE
  //
  // Обновление — только по id. Обновление «по составному ключу»
  // больше невозможно: в слоте может быть несколько результатов,
  // и неясно, какой именно обновлять.
  //
  // assertCompletedHasMetric нужен, потому что DTO проверяет
  // только переданные в PATCH поля, а правило «completed требует
  // метрику в итоге» относится к состоянию ПОСЛЕ merge с current.
  // ============================================================

  async updateById(
    id: string,
    data: Partial<UpdateResultData>,
  ): Promise<ResultWithLinks> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new NotFoundException(`Result with id ${id} not found`);
    }

    const nextStatus: ResultStatus = data.status ?? current.status;
    const nextMetrics = {
      time: data.time !== undefined ? data.time : current.time,
      level: data.level !== undefined ? data.level : current.level,
      segments: data.segments !== undefined ? data.segments : current.segments,
    };
    this.assertCompletedHasMetric(nextStatus, nextMetrics);

    const updated = await this.repository.updateById(id, data);
    if (!updated) {
      throw new NotFoundException(`Result with id ${id} not found`);
    }

    const links = await this.repository.findLinksByResultId(id);
    return {
      result: updated,
      testTypeIds: links.map((l) => l.testTypeId),
    };
  }

  // ============================================================
  // DELETE
  //
  // Транзакции и удаление связей — в репозитории.
  //
  // deleteById — удаляет одну строку по id (и её связи).
  // deleteAllByComposite — удаляет ВСЕ строки в слоте (и их связи).
  // ============================================================

  async deleteById(id: string): Promise<void> {
    const deleted = await this.repository.deleteResultById(id);
    if (!deleted) {
      throw new NotFoundException(`Result with id ${id} not found`);
    }
  }

  /**
   * Удаление ВСЕХ результатов в слоте (user, camp, is_10m, leg)
   * вместе с их связями. Используется, когда нужно вычистить
   * слот целиком, независимо от того, сколько там результатов.
   */
  async deleteAllByComposite(
    userId: string,
    trainingCampId: string,
    isTen: boolean,
    legNumber: number,
  ): Promise<void> {
    const deleted = await this.repository.deleteAllResultsByComposite(
      userId,
      trainingCampId,
      isTen,
      legNumber,
    );
    if (deleted.length === 0) {
      throw new NotFoundException(
        `Results for user ${userId}, camp ${trainingCampId}, ` +
          `isTen ${isTen}, leg ${legNumber} not found`,
      );
    }
  }

  async deleteAllByUserAndCamp(
    userId: string,
    trainingCampId: string,
  ): Promise<void> {
    await this.repository.deleteAllResultsByUserAndCamp(userId, trainingCampId);
  }

  async deleteAllByUserAndCampAndTestType(
    userId: string,
    trainingCampId: string,
    testTypeId: string,
  ): Promise<void> {
    await this.repository.deleteAllResultsByUserAndCampAndTestType(
      userId,
      trainingCampId,
      testTypeId,
    );
  }
}
