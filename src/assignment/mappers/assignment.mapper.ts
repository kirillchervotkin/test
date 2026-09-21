// src/assignments/mappers/assignment.mapper.ts

import { CreateAssignmentDto } from '../dto/createAssignment.dto.js';
import { UpdateAssignmentDto } from '../dto/updateAssignment.dto.js';
import { AssignmentResponseDto } from '../dto/assignmentResponse.dto.js';
import { AssignmentWithDetailsResponseDto } from '../dto/assignmentWithDetailsResponse.dto.js';
import {
  Assignment,
  CreateAssignmentData,
  UpdateAssignmentData,
  AssignmentWithDetails,
} from '../entities/types/assignment.types.js';

export class AssignmentMapper {
  // ============================================================
  // DTO → DATA
  // ============================================================

  /**
   * Преобразует DTO создания в данные для репозитория.
   *
   * `matchId` приходит отдельным аргументом из URL-параметра
   * `:matchId` контроллера, а не из тела DTO. Так клиент не может
   * создать назначение не тому матчу, для которого открыт редактор
   * бригады.
   *
   * Все поля обязательны: `userId` и `fieldRoleId` — из DTO,
   * `matchId` — из аргумента. Никакой фильтрации null/undefined
   * не нужно (в отличие от CityMapper или MatchMapper): у назначения
   * нет nullable-полей.
   *
   * Конвертации типов нет: все поля — строки (UUID).
   */
  static toCreateData(
    matchId: string,
    dto: CreateAssignmentDto,
  ): CreateAssignmentData {
    return {
      matchId,
      userId: dto.userId,
      fieldRoleId: dto.fieldRoleId,
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
   * `null` не допускается: у назначения нет nullable-полей,
   * «обнулять» нечего. DTO это гарантирует через `@IsUUID()`
   * без `nullable: true`.
   *
   * `matchId` не входит в патч: перенос назначения на другой матч —
   * это delete + create (см. UpdateAssignmentData).
   *
   * Пустой патч допустим — репозиторий вернёт текущую запись
   * без изменений (см. updatePartial).
   */
  static toUpdateData(
    id: string,
    dto: UpdateAssignmentDto,
  ): UpdateAssignmentData {
    const data: UpdateAssignmentData = { id };

    if (dto.userId !== undefined) data.userId = dto.userId;
    if (dto.fieldRoleId !== undefined) data.fieldRoleId = dto.fieldRoleId;

    return data;
  }

  // ============================================================
  // ENTITY → DTO (базовый ответ)
  // ============================================================

  /**
   * Преобразует доменную сущность Assignment в DTO ответа.
   * Плоская структура — все поля на верхнем уровне.
   *
   * Без деталей (ФИО судьи, название роли) — только ID-ссылки.
   * Используется в CRUD-контроллере: `GET /matches/:id/assignments`,
   * `PATCH /assignments/:id` и т.д.
   *
   * Для отображения с деталями — `toWithDetailsDto`.
   */
  static toDto(entity: Assignment): AssignmentResponseDto {
    return {
      id: entity.id,
      matchId: entity.matchId,
      userId: entity.userId,
      fieldRoleId: entity.fieldRoleId,
    };
  }

  /**
   * Преобразует список доменных сущностей в массив DTO.
   */
  static toDtoList(entities: Assignment[]): AssignmentResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }

  // ============================================================
  // ENTITY → DTO (с деталями)
  // ============================================================

  /**
   * Преобразует доменную сущность AssignmentWithDetails в DTO
   * с ФИО судьи и данными роли.
   *
   * Используется в MatchCrewController: `GET /matches/:id/crew`.
   * Фронт получает всё, что нужно для отображения бригады,
   * без дополнительных запросов.
   *
   * `roleCode` — ключ для локализации на фронте.
   * `roleName` — русский fallback.
   * `roleSortOrder` — порядок отображения (Главный судья первый).
   */
  static toWithDetailsDto(
    entity: AssignmentWithDetails,
  ): AssignmentWithDetailsResponseDto {
    return {
      id: entity.id,
      matchId: entity.matchId,
      userId: entity.userId,
      userFirstName: entity.userFirstName,
      userLastName: entity.userLastName,
      fieldRoleId: entity.fieldRoleId,
      roleCode: entity.roleCode,
      roleName: entity.roleName,
      roleSortOrder: entity.roleSortOrder,
    };
  }

  /**
   * Преобразует список доменных сущностей с деталями
   * в массив DTO.
   */
  static toWithDetailsDtoList(
    entities: AssignmentWithDetails[],
  ): AssignmentWithDetailsResponseDto[] {
    return entities.map((e) => this.toWithDetailsDto(e));
  }
}
