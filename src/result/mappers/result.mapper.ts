// src/results/mappers/result.mapper.ts

import { ResultResponseDto } from '../dto/response.dto.js';
import { UpdateResultDto } from '../dto/update-result.dto.js';
import { UploadResultsDto } from '../dto/upload-results.dto.js';
import { CreateResultsDto } from '../dto/create-results.dto.js';
import {
  Result,
  CreateResultData,
  UpdateResultData,
} from '../entities/types/result.types.js';

export class ResultMapper {
  // ============================================================
  // DTO → DATA
  // ============================================================

  /**
   * Преобразует UploadResultsDto в плоский массив CreateResultData.
   * testTypeIds здесь НЕ используется — типы тестов привязываются
   * отдельно, через ResultTestTypeRepository.attachTestTypes.
   *
   * Если `status` в item не задан — считаем 'completed'
   * (обычный сценарий: загружают состоявшийся зачёт).
   */
  static toUploadResultsData(
    campId: string,
    dto: UploadResultsDto,
  ): CreateResultData[] {
    const { users, trainingCampId: dtoCampId } = dto;
    const effectiveCampId = dtoCampId || campId;

    const resultData: CreateResultData[] = [];
    for (const user of users) {
      for (const item of user.items) {
        resultData.push({
          userId: user.userId,
          trainingCampId: effectiveCampId,
          status: item.status ?? 'completed',
          isTen: item.isTen,
          legNumber: item.legNumber,
          time: item.time ?? null,
          level: item.level ?? null,
          segments: item.segments ?? null,
        });
      }
    }
    return resultData;
  }

  /**
   * Преобразует CreateResultsDto в плоский массив CreateResultData
   * для одного пользователя в одном сборе.
   */
  static toCreateBulkData(
    userId: string,
    trainingCampId: string,
    dto: CreateResultsDto,
  ): CreateResultData[] {
    const { items } = dto;
    return items.map((item) => ({
      userId,
      trainingCampId,
      status: item.status ?? 'completed',
      isTen: item.isTen,
      legNumber: item.legNumber,
      time: item.time ?? null,
      level: item.level ?? null,
      segments: item.segments ?? null,
    }));
  }

  /**
   * Преобразует UpdateResultDto в UpdateResultData.
   * testTypeId здесь НЕ обновляется — управление связями идёт
   * через отдельные endpoint'ы /results/:resultId/test-types.
   *
   * `status` пишется только если явно передан — иначе поле
   * не трогаем (PATCH-семантика).
   */
  static toUpdateResultData(
    id: string,
    dto: UpdateResultDto,
  ): UpdateResultData {
    const data: UpdateResultData = { id };
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.time !== undefined) data.time = dto.time;
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.segments !== undefined) data.segments = dto.segments;
    return data;
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================

  /**
   * Преобразует доменную сущность Result в DTO ответа.
   * testTypeIds передаются отдельно — их тянет сервис из
   * result_test_types, чтобы не делать N+1 в маппере.
   */
  static toDto(result: Result, testTypeIds: string[] = []): ResultResponseDto {
    return {
      id: result.id,
      userId: result.userId,
      trainingCampId: result.trainingCampId,
      isTen: result.isTen,
      legNumber: result.legNumber,
      status: result.status,
      time: result.time,
      level: result.level,
      segments: result.segments,
      testTypeIds,
    };
  }

  /**
   * Преобразует список результатов в DTO.
   * linksByResultId — карта {resultId → [testTypeId, ...]}, собранная
   * пакетно в сервисе через ResultTestTypeRepository.findByResultIds.
   */
  static toDtoList(
    results: Result[],
    linksByResultId: Map<string, string[]> = new Map(),
  ): ResultResponseDto[] {
    return results.map((r) => this.toDto(r, linksByResultId.get(r.id) ?? []));
  }
}
