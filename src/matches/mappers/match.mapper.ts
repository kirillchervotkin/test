// src/matches/mappers/match.mapper.ts

import { CreateMatchDto } from '../dto/createMatch.dto.js';
import { UpdateMatchDto } from '../dto/updateMatch.dto.js';
import { MatchResponseDto } from '../dto/matchResponse.dto.js';
import {
  Match,
  CreateMatchInput,
  UpdateMatchData,
} from '../entities/types/match.types.js';

export class MatchMapper {
  // ============================================================
  // DTO → DATA
  // ============================================================

  /**
   * Преобразует DTO создания в данные для репозитория.
   *
   * Возвращает {@link CreateMatchInput} — БЕЗ `tournamentId`.
   * Клиент его не передаёт; `tournamentId` выводится в
   * `MatchRepository.create` из `stage.tournamentId` в той же
   * транзакции, что и INSERT. Это гарантирует согласованность
   * `stage ↔ tournament` by design.
   *
   * Ключевая конвертация — `matchDate`: в DTO это строка ISO 8601
   * (`@IsDateString()`), в domain-типе — `Date`. Конвертация здесь,
   * чтобы репозиторий работал только с типизированными значениями.
   *
   * Семантика `undefined` vs `null` (create-путь):
   *   - `undefined` — поле не передано, ключ в объект НЕ попадает.
   *   - `null` — на create трактуется так же, как отсутствие.
   *     Для `tourNumber` — «нет тура» (плей-офф). Для `homeTeamId`
   *     / `awayTeamId` — «участник ещё не определён». В обоих
   *     случаях ключ в объект не попадает, YDB заполнит NULL
   *     по умолчанию.
   *
   * Это критично для YDB: явный `null` в bind-параметрах драйвер
   * сериализует в protobuf `null_type`, который YDB не принимает
   * (GENERIC_ERROR: Unsupported protobuf type: null_type).
   */
  static toCreateData(dto: CreateMatchDto): CreateMatchInput {
    const data: CreateMatchInput = {
      stageId: dto.stageId,
      matchDate: new Date(dto.matchDate),
      cityId: dto.cityId,
    };

    if (dto.tourNumber != null) {
      data.tourNumber = dto.tourNumber;
    }
    if (dto.homeTeamId != null) {
      data.homeTeamId = dto.homeTeamId;
    }
    if (dto.awayTeamId != null) {
      data.awayTeamId = dto.awayTeamId;
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
   *     превратит его в SQL-литерал NULL (не в bind-параметр).
   *
   * Примеры:
   *   PATCH /matches/:id { homeTeamId: null }  → убрать хозяев
   *   PATCH /matches/:id { awayTeamId: null }  → убрать гостей
   *   PATCH /matches/:id { homeScore: null }   → сбросить счёт
   *   PATCH /matches/:id { tourNumber: null }  → снять номер тура
   *
   * Пустой патч допустим — репозиторий вернёт текущую запись
   * без изменений (см. updatePartial).
   *
   * `tournamentId` и `stageId` не входят в UpdateMatchData:
   * перенос матча между турнирами/этапами — это delete + create.
   */
  static toUpdateData(id: string, dto: UpdateMatchDto): UpdateMatchData {
    const data: UpdateMatchData = { id };

    // matchDate: string → Date, если передана.
    if (dto.matchDate !== undefined) {
      data.matchDate = new Date(dto.matchDate);
    }

    if (dto.cityId !== undefined) data.cityId = dto.cityId;

    // tourNumber: null → снять тур, значение → заменить.
    if (dto.tourNumber !== undefined) {
      data.tourNumber = dto.tourNumber;
    }

    // homeTeamId / awayTeamId: null → снять команду,
    // значение → заменить.
    if (dto.homeTeamId !== undefined) {
      data.homeTeamId = dto.homeTeamId;
    }
    if (dto.awayTeamId !== undefined) {
      data.awayTeamId = dto.awayTeamId;
    }

    // homeScore / awayScore: null → сбросить счёт,
    // значение → установить.
    if (dto.homeScore !== undefined) {
      data.homeScore = dto.homeScore;
    }
    if (dto.awayScore !== undefined) {
      data.awayScore = dto.awayScore;
    }

    return data;
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================

  /**
   * Преобразует доменную сущность Match в DTO ответа.
   * Плоская структура — все поля на верхнем уровне.
   *
   * Date-объекты сериализуются в ISO-строки автоматически при
   * JSON-сериализации NestJS. В DTO `matchDate` объявлен как `Date`,
   * что соответствует domain-типу; наружу уйдёт ISO-строка.
   *
   * Nullable-поля (`tourNumber`, `homeTeamId`, `awayTeamId`,
   * `homeScore`, `awayScore`) передаются как есть — без
   * преобразований.
   */
  static toDto(entity: Match): MatchResponseDto {
    return {
      id: entity.id,
      tournamentId: entity.tournamentId,
      stageId: entity.stageId,
      tourNumber: entity.tourNumber,
      matchDate: entity.matchDate,
      cityId: entity.cityId,
      homeTeamId: entity.homeTeamId,
      awayTeamId: entity.awayTeamId,
      homeScore: entity.homeScore,
      awayScore: entity.awayScore,
    };
  }

  /**
   * Преобразует список доменных сущностей в массив DTO.
   */
  static toDtoList(entities: Match[]): MatchResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }
}
