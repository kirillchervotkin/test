// src/cities/mappers/city.mapper.ts

import { CreateCityDto } from '../dto/createCity.dto.js';
import { UpdateCityDto } from '../dto/updateCity.dto.js';
import { CityResponseDto } from '../dto/cityResponse.dto.js';
import {
  City,
  CreateCityData,
  UpdateCityData,
} from '../entities/types/city.types.js';

export class CityMapper {
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
   */
  static toCreateData(dto: CreateCityDto): CreateCityData {
    const data: CreateCityData = {
      name: dto.name,
    };

    if (dto.region != null) {
      data.region = dto.region;
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
   * Пример:
   *   PATCH /cities/:id { region: null }  → очистить регион
   *
   * Пустой патч допустим — репозиторий вернёт текущую запись
   * без изменений (см. updatePartial).
   */
  static toUpdateData(id: string, dto: UpdateCityDto): UpdateCityData {
    const data: UpdateCityData = { id };

    if (dto.name !== undefined) data.name = dto.name;

    // region: null → «очистить регион», значение → заменить.
    if (dto.region !== undefined) {
      data.region = dto.region;
    }

    return data;
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================

  /**
   * Преобразует доменную сущность City в DTO ответа.
   * Плоская структура — все поля на верхнем уровне.
   *
   * Date-объекты сериализуются в ISO-строки автоматически при
   * JSON-сериализации NestJS.
   */
  static toDto(entity: City): CityResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      region: entity.region,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  /**
   * Преобразует список доменных сущностей в массив DTO.
   */
  static toDtoList(entities: City[]): CityResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }
}
