// src/test-grades/mappers/test-grade.mapper.ts

import { CreateTestGradeDto } from '../dto/create-test-grade.dto.js';
import { UpdateTestGradeDto } from '../dto/update-test-grade.dto.js';
import { ApplyTestGradeDiffDto } from '../dto/apply-test-grade-diff.dto.js';
import { TestGradeResponseDto } from '../dto/test-grade-response.dto.js';
import {
  TestGrade,
  CreateTestGradeData,
} from '../entities/types/test-grade.types.js';
import {
  TestGradeDiff,
  TestGradePatch,
} from '../repository/test-grade.ydb.repository.js';

export class TestGradeMapper {
  // ============================================================
  // DTO → DATA
  // ============================================================

  /**
   * Преобразует DTO создания в данные для репозитория.
   *
   * testTypeId приходит отдельным аргументом из URL-параметра
   * `:testTypeId` контроллера, а не из тела DTO. Так клиент не
   * может создать градацию не тому типу, для которого открыт
   * редактор.
   */
  static toCreateData(
    testTypeId: string,
    dto: CreateTestGradeDto,
  ): CreateTestGradeData {
    return {
      testTypeId,
      grade: dto.grade,
      threshold: dto.threshold,
      color: dto.color,
    };
  }

  /**
   * Преобразует DTO обновления в патч для репозитория.
   * id берётся из параметра маршрута, а не из тела.
   *
   * Обновляются только те поля, которые явно переданы в DTO.
   * Пустой объект допустим — репозиторий вернёт текущую запись
   * без изменений (см. updateByIdAndTestType).
   *
   * testTypeId не обновляется: «переезд» градации в другой тип
   * теста — это отдельный сценарий (delete + create).
   */
  static toUpdateData(dto: UpdateTestGradeDto): TestGradePatch {
    const data: TestGradePatch = {};
    if (dto.grade !== undefined) data.grade = dto.grade;
    if (dto.threshold !== undefined) data.threshold = dto.threshold;
    if (dto.color !== undefined) data.color = dto.color;
    return data;
  }

  /**
   * Преобразует DTO diff в доменный TestGradeDiff для репозитория.
   *
   * testTypeId в элементы create НЕ подставляется — он передаётся
   * отдельным параметром в applyDiff и берётся из URL. Дублировать
   * его в каждом элементе — риск «смешанного» батча.
   *
   * Отсутствующие массивы (undefined) превращаются в пустые —
   * репозиторий ожидает все три поля обязательными.
   */
  static toDiff(dto: ApplyTestGradeDiffDto): TestGradeDiff {
    return {
      create: (dto.create ?? []).map((item) => ({
        grade: item.grade,
        threshold: item.threshold,
        color: item.color,
      })),
      update: (dto.update ?? []).map((item) => {
        const patch: { id: string } & TestGradePatch = { id: item.id };
        if (item.grade !== undefined) patch.grade = item.grade;
        if (item.threshold !== undefined) patch.threshold = item.threshold;
        if (item.color !== undefined) patch.color = item.color;
        return patch;
      }),
      delete: dto.delete ?? [],
    };
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================

  /**
   * Преобразует доменную сущность TestGrade в DTO ответа.
   * Плоская структура — все поля на верхнем уровне,
   * никаких вложенных объектов.
   */
  static toDto(entity: TestGrade): TestGradeResponseDto {
    return {
      id: entity.id,
      testTypeId: entity.testTypeId,
      grade: entity.grade,
      threshold: entity.threshold,
      color: entity.color,
    };
  }

  /**
   * Преобразует список доменных сущностей в массив DTO.
   */
  static toDtoList(entities: TestGrade[]): TestGradeResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }
}
