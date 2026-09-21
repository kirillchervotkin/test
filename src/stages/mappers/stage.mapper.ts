// src/stages/mappers/stage.mapper.ts

import { CreateStageDto } from '../dto/createStage.dto.js';
import { UpdateStageDto } from '../dto/updateStage.dto.js';
import { StageResponseDto } from '../dto/stageResponse.dto.js';
import {
  Stage,
  CreateStageData,
  UpdateStageData,
} from '../entities/types/stage.types.js';

export class StageMapper {
  // ============================================================
  // DTO → DATA
  // ============================================================

  /**
   * Преобразует DTO создания в данные для репозитория.
   *
   * `tournamentId` приходит отдельным аргументом из URL-параметра
   * `:tournamentId` контроллера, а не из тела DTO. Так клиент
   * не может создать этап в чужом турнире.
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
   * `sortOrder` не подставляем, если не передан — репозиторий
   * подставит 0 по умолчанию (data.sortOrder ?? 0).
   */
  static toCreateData(
    tournamentId: string,
    dto: CreateStageDto,
  ): CreateStageData {
    const data: CreateStageData = {
      tournamentId,
      name: dto.name,
      type: dto.type,
    };

    if (dto.format != null) {
      data.format = dto.format;
    }
    if (dto.parentStageId != null) {
      data.parentStageId = dto.parentStageId;
    }
    if (dto.sortOrder !== undefined) {
      data.sortOrder = dto.sortOrder;
    }
    if (dto.settings != null) {
      data.settings = dto.settings;
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
   *   PATCH /stages/:id { parentStageId: null }  → этап становится корневым
   *   PATCH /stages/:id { format: null }         → этап становится контейнером
   *   PATCH /stages/:id { settings: null }       → настройки очищены
   *
   * Согласованность `type` ↔ `format` НЕ проверяется здесь:
   * DTO не видит текущего состояния сущности. Проверка — в
   * StageService.update через isTypeFormatConsistent.
   *
   * Пустой патч допустим — репозиторий вернёт текущую запись
   * без изменений (см. updatePartial).
   */
  static toUpdateData(id: string, dto: UpdateStageDto): UpdateStageData {
    const data: UpdateStageData = { id };

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;

    // format: null → «сделать контейнером», значение → сменить формат.
    if (dto.format !== undefined) {
      data.format = dto.format;
    }

    // parentStageId: null → «сделать корневым», значение → привязать к родителю.
    if (dto.parentStageId !== undefined) {
      data.parentStageId = dto.parentStageId;
    }

    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    // settings: null → «очистить настройки», объект → заменить.
    if (dto.settings !== undefined) {
      data.settings = dto.settings;
    }

    return data;
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================

  /**
   * Преобразует доменную сущность Stage в DTO ответа.
   * Плоская структура — все поля на верхнем уровне.
   *
   * Date-объекты сериализуются в ISO-строки автоматически при
   * JSON-сериализации NestJS; в DTO они объявлены как `Date`,
   * что соответствует domain-типу.
   *
   * `settings` передаётся как есть: domain-тип хранит его
   * в виде `Record<string, unknown> | null`, DTO — так же.
   */
  static toDto(entity: Stage): StageResponseDto {
    return {
      id: entity.id,
      tournamentId: entity.tournamentId,
      parentStageId: entity.parentStageId,
      name: entity.name,
      type: entity.type,
      format: entity.format,
      sortOrder: entity.sortOrder,
      settings: entity.settings,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Преобразует список доменных сущностей в массив DTO.
   */
  static toDtoList(entities: Stage[]): StageResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }
}
