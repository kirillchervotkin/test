// src/test-types/mappers/test-type.mapper.ts

import { CreateTestTypeDto } from '../dto/create-test-type.dto.js';
import { UpdateTestTypeDto } from '../dto/update-test-type.dto.js';
import { TestTypeResponseDto } from '../dto/response.dto.js';
import {
  CreateTestTypeData,
  UpdateTestTypeData,
  TestType,
  resolveParameter,
} from '../entities/types/test-type.types.js';

export class TestTypeMapper {
  /**
   * Преобразует DTO создания в данные для репозитория.
   *
   * Возвращаемый объект содержит ТОЛЬКО те поля порогов, которые
   * относятся к вычисленному `parameter`:
   *   - time     → failThresholdTime + attemptsCount
   *   - segments → failThresholdSegments
   *   - level    → failThresholdLevel + failThresholdSegments
   *
   * Нерелевантные поля не включаются в объект вообще. Это важно для
   * YDB: если передать их как `null`, драйвер попытается
   * сериализовать значение как protobuf `null_type`, который YDB
   * не поддерживает (см. ошибку GENERIC_ERROR: Unsupported protobuf
   * type: null_type: NULL_VALUE). Если ключа в объекте нет,
   * Drizzle не добавляет колонку в INSERT, и БД подставляет NULL
   * по умолчанию — без явного null-параметра.
   *
   * Поле `parameter` в DTO отсутствует — оно детерминированно
   * выводится из комбинации порогов (см. resolveParameter).
   */
  static toCreateData(dto: CreateTestTypeDto): CreateTestTypeData {
    const parameter = resolveParameter({
      failThresholdTime: dto.failThresholdTime ?? null,
      failThresholdLevel: dto.failThresholdLevel ?? null,
      failThresholdSegments: dto.failThresholdSegments ?? null,
    });

    const data: CreateTestTypeData = {
      name: dto.name,
      gender: dto.gender,
      parameter,
    };

    if (parameter === 'time') {
      data.failThresholdTime = dto.failThresholdTime!;
      data.attemptsCount = dto.attemptsCount!;
    } else if (parameter === 'segments') {
      data.failThresholdSegments = dto.failThresholdSegments!;
    } else {
      // level
      data.failThresholdLevel = dto.failThresholdLevel!;
      data.failThresholdSegments = dto.failThresholdSegments!;
    }

    return data;
  }

  /**
   * Преобразует DTO обновления в данные для репозитория.
   * id берётся из параметра маршрута, а не из тела.
   *
   * Семантика проверок `has*` совпадает с DTO-валидатором
   * (`ThresholdCombinationUpdateConstraint`): `null` и `undefined`
   * оба означают «не передано». Это устраняет прежнюю
   * рассогласованность, когда явный `null` в теле запроса
   * валидатор пропускал как «ничего не передано», а маппер
   * реагировал на него как на смену порогов.
   *
   * Если пороги затронуты, клиент обязан прислать полный набор для
   * целевого типа теста (это гарантирует валидатор DTO). Тогда:
   *   - `parameter` пересчитывается из присланного набора;
   *   - поля старого типа явно обнуляются через `null`, чтобы
   *     Drizzle включил их в SET (без этого старое значение
   *     осталось бы в БД).
   *
   * ⚠️ Обнуление через явный `null` в UPDATE может упереться в ту же
   * проблему YDB-адаптера, что и INSERT. Если это случится —
   * в репозитории нужно либо оборачивать null в `Optional<T>` из
   * `@ydbjs/value`, либо использовать generic-фильтр undefined
   * (см. training-camp.repository.ts).
   */
  static toUpdateData(id: string, dto: UpdateTestTypeDto): UpdateTestTypeData {
    const data: UpdateTestTypeData = { id };

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.gender !== undefined) data.gender = dto.gender;

    // Та же семантика, что и в валидаторе DTO: null ≡ undefined.
    const hasTime = dto.failThresholdTime != null;
    const hasLevel = dto.failThresholdLevel != null;
    const hasSegments = dto.failThresholdSegments != null;

    if (hasTime || hasLevel || hasSegments) {
      const parameter = resolveParameter({
        failThresholdTime: dto.failThresholdTime ?? null,
        failThresholdLevel: dto.failThresholdLevel ?? null,
        failThresholdSegments: dto.failThresholdSegments ?? null,
      });
      data.parameter = parameter;

      if (parameter === 'time') {
        data.failThresholdTime = dto.failThresholdTime!;
        data.failThresholdLevel = null;
        data.failThresholdSegments = null;
      } else if (parameter === 'segments') {
        data.failThresholdTime = null;
        data.failThresholdLevel = null;
        data.failThresholdSegments = dto.failThresholdSegments!;
      } else {
        // level
        data.failThresholdTime = null;
        data.failThresholdLevel = dto.failThresholdLevel!;
        data.failThresholdSegments = dto.failThresholdSegments!;
      }
    }

    if (dto.attemptsCount !== undefined) {
      data.attemptsCount = dto.attemptsCount ?? null;
    }

    return data;
  }

  /**
   * Преобразует доменную сущность в DTO для ответа клиенту.
   * `parameter` и `attemptsCount` передаются как есть — источник
   * истины по ним это БД (и сервисный слой, который их согласует).
   */
  static toDto(entity: TestType): TestTypeResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      gender: entity.gender,
      parameter: entity.parameter,
      failThresholdTime: entity.failThresholdTime,
      failThresholdLevel: entity.failThresholdLevel,
      failThresholdSegments: entity.failThresholdSegments,
      attemptsCount: entity.attemptsCount,
    };
  }

  /**
   * Преобразует список доменных сущностей в массив DTO.
   */
  static toDtoList(entities: TestType[]): TestTypeResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }
}
