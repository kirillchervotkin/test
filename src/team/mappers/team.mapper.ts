// src/teams/mappers/team.mapper.ts

import { CreateTeamDto } from '../dto/createTeam.dto.js';
import { UpdateTeamDto } from '../dto/updateTeam.dto.js';
import { TeamResponseDto } from '../dto/teamResponse.dto.js';
import {
  Team,
  CreateTeamData,
  UpdateTeamData,
} from '../entities/types/team.types.js';

export class TeamMapper {
  // ============================================================
  // DTO → DATA
  // ============================================================

  /**
   * Преобразует DTO создания в данные для репозитория.
   *
   * Семантика `undefined` vs `null` (create-путь):
   *   - `undefined` — поле не передано, ключ в объект НЕ попадает.
   *   - `null` — на create трактуется так же, как отсутствие
   *     (нельзя «обнулить» то, чего ещё нет). Тоже не попадает.
   *
   * Отсутствующие в INSERT колонки YDB заполнит NULL по умолчанию,
   * без явного null-параметра. Это критично: драйвер YDB сериализует
   * JS-`null` в protobuf `null_type`, который YDB не принимает
   * (GENERIC_ERROR: Unsupported protobuf type: null_type).
   *
   * `shortName` и `cityId` — опциональны. Для сборных `cityId`
   * может отсутствовать.
   */
  static toCreateData(dto: CreateTeamDto): CreateTeamData {
    const data: CreateTeamData = {
      name: dto.name,
    };

    if (dto.shortName != null) {
      data.shortName = dto.shortName;
    }
    if (dto.cityId != null) {
      data.cityId = dto.cityId;
    }

    return data;
  }

  /**
   * Преобразует DTO обновления в данные для репозитория.
   * id берётся из параметра маршрута, а не из тела.
   *
   * Семантика `undefined` vs `null` здесь РАЗНАЯ:
   *   - `undefined` — поле не передано, не трогаем в БД.
   *   - `null` — явное «обнулить значение». Поле попадает в объект
   *     со значением `null`, а репозиторий через nullsToSql
   *     превратит его в SQL-литерал `NULL` (не в bind-параметр).
   *
   * Примеры:
   *   PATCH /teams/:id { shortName: null }  → убрать короткое имя
   *   PATCH /teams/:id { cityId: null }     → убрать домашний город
   *
   * Пустой патч допустим — репозиторий вернёт текущую запись
   * без изменений (см. updatePartial).
   */
  static toUpdateData(id: string, dto: UpdateTeamDto): UpdateTeamData {
    const data: UpdateTeamData = { id };

    if (dto.name !== undefined) data.name = dto.name;

    // shortName: null → «убрать короткое имя», значение → заменить.
    if (dto.shortName !== undefined) {
      data.shortName = dto.shortName;
    }

    // cityId: null → «убрать домашний город», значение → заменить.
    if (dto.cityId !== undefined) {
      data.cityId = dto.cityId;
    }

    return data;
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================

  /**
   * Преобразует доменную сущность Team в DTO ответа.
   * Плоская структура — все поля на верхнем уровне.
   *
   * `shortName` и `cityId` передаются как `string | null` —
   * без преобразований. У команды нет `createdAt` / `updatedAt`
   * (в схеме этих полей нет).
   */
  static toDto(entity: Team): TeamResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      shortName: entity.shortName,
      cityId: entity.cityId,
    };
  }

  /**
   * Преобразует список доменных сущностей в массив DTO.
   */
  static toDtoList(entities: Team[]): TeamResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }
}
