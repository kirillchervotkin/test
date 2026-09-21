// src/teams/entities/types/team.types.ts

/**
 * Внутреннее представление команды (доменная сущность).
 * Используется в репозитории и сервисе.
 *
 * Команда — глобальный справочник. Не привязана к турниру,
 * не имеет иерархии. Используется в матчах (`matches.home_team_id`,
 * `matches.away_team_id`) для указания участников.
 *
 * Поля:
 *   - `name` — полное название («Зенит», «Манчестер Юнайтед»).
 *   - `shortName` — короткое название для UI-таблиц («ЗЕН», «МЮ»).
 *     Опционально, может быть NULL.
 *   - `cityId` — домашний город команды. Опциональная ссылка
 *     на `cities.id`. Может быть NULL (например, для сборных).
 */
export interface Team {
  id: string;
  name: string;
  shortName: string | null;
  cityId: string | null;
}

/**
 * Данные для создания команды.
 *
 * Отличается от `Team`:
 *   1. Нет `id` — его генерирует репозиторий (uuidv4).
 *   2. `shortName` и `cityId` — ОПЦИОНАЛЬНЫ.
 *
 * Семантика `undefined` vs `null`:
 *   - `undefined` — поле не передано, ключ в объект НЕ попадает.
 *     Репозиторий отсеет его фильтром, и YDB подставит NULL
 *     по умолчанию, без явного null-параметра.
 *   - `null` — на create-пути трактуется так же, как отсутствие
 *     (нельзя «обнулить» то, чего ещё нет). Тоже не попадает
 *     в объект.
 *
 * Это критично для YDB: явный `null` в bind-параметрах драйвер
 * сериализует в protobuf `null_type`, который YDB не принимает
 * (GENERIC_ERROR: Unsupported protobuf type: null_type: NULL_VALUE).
 */
export interface CreateTeamData {
  name: string;
  shortName?: string;
  cityId?: string;
}

/**
 * Данные для частичного обновления команды.
 *
 * Все поля кроме `id` — опциональны. `shortName` и `cityId`
 * допускают явный `null`, означающий «обнулить значение в БД».
 *
 * Семантика `undefined` vs `null` здесь РАЗНАЯ:
 *   - `undefined` — поле не передано, не трогаем в БД.
 *   - `null` — явное «обнулить». Поле попадает в объект
 *     со значением `null`, а репозиторий через nullsToSql
 *     превратит его в SQL-литерал NULL (не в bind-параметр).
 *
 * Примеры:
 *   PATCH /teams/:id { shortName: null }  → убрать короткое имя
 *   PATCH /teams/:id { cityId: null }     → убрать домашний город
 */
export type UpdateTeamData = {
  id: string;
} & Partial<Omit<Team, 'id'>>;

/**
 * Фильтры для поиска команд.
 * Все поля опциональны — комбинируются через AND.
 */
export interface TeamFilters {
  name?: string; // поиск по подстроке (LIKE %name%)
  shortName?: string; // поиск по подстроке (LIKE %shortName%)
  cityId?: string; // точное совпадение
}
