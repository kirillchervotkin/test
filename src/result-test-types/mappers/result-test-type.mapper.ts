// src/result-test-types/mappers/result-test-type.mapper.ts

import { AttachTestTypesDto } from '../dto/attach-test-types.dto.js';
import { ResultTestTypeResponseDto } from '../dto/result-test-type-response.dto.js';
import {
  ResultTestType,
  CreateResultTestTypeData,
} from '../entities/types/result-test-type.types.js';

export class ResultTestTypeMapper {
  // ============================================================
  // DTO → DATA
  // Привязка одного или нескольких типов тестов к результату.
  // Возвращает массив данных для вставки в result_test_types.
  // ============================================================
  static toAttachData(
    resultId: string,
    dto: AttachTestTypesDto,
  ): CreateResultTestTypeData[] {
    return dto.testTypeIds.map((testTypeId) => ({
      resultId,
      testTypeId,
    }));
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================
  static toDto(link: ResultTestType): ResultTestTypeResponseDto {
    return {
      resultId: link.resultId,
      testTypeId: link.testTypeId,
    };
  }

  static toDtoList(links: ResultTestType[]): ResultTestTypeResponseDto[] {
    return links.map((link) => this.toDto(link));
  }
}
