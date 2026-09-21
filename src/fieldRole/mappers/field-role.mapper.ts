// src/field-roles/mappers/field-role.mapper.ts

import { CreateFieldRoleDto } from '../dto/createFieldRole.dto.js';
import { UpdateFieldRoleDto } from '../dto/updateFieldRole.dto.js';
import { FieldRoleResponseDto } from '../dto/fieldRoleResponse.dto.js';
import {
  FieldRole,
  CreateFieldRoleData,
  UpdateFieldRoleData,
} from '../entities/types/field-role.types.js';

export class FieldRoleMapper {
  // ============================================================
  // DTO → DATA
  // ============================================================

  /**
   * Преобразует DTO создания в данные для репозитория.
   *
   * Все поля обязательны — у роли нет nullable-полей и опциональных
   * значений. Никакой фильтрации null/undefined не нужно, как в
   * CityMapper или TeamMapper: `code`, `name`, `sortOrder` приходят
   * всегда.
   *
   * Конвертации типов тоже нет: в DTO все поля — строки и числа,
   * в domain-типе — те же строки и числа. `Date` не участвует.
   */
  static toCreateData(dto: CreateFieldRoleDto): CreateFieldRoleData {
    return {
      code: dto.code,
      name: dto.name,
      sortOrder: dto.sortOrder,
    };
  }

  /**
   * Преобразует DTO обновления в данные для репозитория.
   * id берётся из параметра маршрута, а не из тела.
   *
   * Семантика `undefined` vs значение:
   *   - `undefined` — поле не передано, не трогаем в БД.
   *   - значение — заменить.
   *
   * `null` не допускается: у роли нет nullable-полей, «обнулять»
   * нечего. DTO это гарантирует через `@IsString` / `@IsInt` без
   * `nullable: true`.
   *
   * Пустой патч допустим — репозиторий вернёт текущую запись
   * без изменений (см. updatePartial).
   */
  static toUpdateData(
    id: string,
    dto: UpdateFieldRoleDto,
  ): UpdateFieldRoleData {
    const data: UpdateFieldRoleData = { id };

    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return data;
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================

  /**
   * Преобразует доменную сущность FieldRole в DTO ответа.
   * Плоская структура — все поля на верхнем уровне.
   *
   * Никаких преобразований: `code`, `name`, `sortOrder` передаются
   * как есть. У роли нет `createdAt` / `updatedAt` (в схеме этих
   * полей нет).
   *
   * Поле `code` — ключ для локализации на фронте. Фронт переводит
   * по нему; `name` — fallback, если перевода нет.
   */
  static toDto(entity: FieldRole): FieldRoleResponseDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      sortOrder: entity.sortOrder,
    };
  }

  /**
   * Преобразует список доменных сущностей в массив DTO.
   */
  static toDtoList(entities: FieldRole[]): FieldRoleResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }
}
