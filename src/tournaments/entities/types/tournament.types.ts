// src/tournaments/entities/types/tournament.types.ts

/**
 * Внутреннее представление турнира (доменная сущность).
 * Используется в репозитории и сервисе.
 *
 * Поле `type` определяет характер соревнования:
 *   - 'LEAGUE'    — регулярный чемпионат (Вторая лига А/Б)
 *   - 'CUP'       — кубок со стадиями и плей-офф (Кубок России)
 *   - 'SUPER_CUP' — одноматчевый турнир
 *
 * Поля `startDate` и `endDate` — опциональны: на момент создания
 * турнира точные даты могут быть ещё не известны.
 */
export interface Tournament {
  id: string;
  name: string;
  season: string; // '2023/24'
  type: TournamentType;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Данные для создания турнира.
 *
 * Отличается от `Tournament`:
 *   1. Нет `id` — его генерирует репозиторий (uuidv4).
 *   2. Нет `createdAt` / `updatedAt` — их проставляет репозиторий.
 *   3. `startDate` и `endDate` — ОПЦИОНАЛЬНЫ. Если не переданы,
 *      колонки в INSERT не попадают, и YDB подставляет NULL
 *      по умолчанию.
 *
 * `null` в этих полях не допускается на create-пути: у создаваемой
 * записи ещё нет «старого значения», которое нужно было бы обнулять.
 * Обнуление — задача update-пути.
 */
export interface CreateTournamentData {
  name: string;
  season: string;
  type: TournamentType;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Данные для частичного обновления турнира.
 *
 * Все поля кроме `id` — опциональны. `startDate` и `endDate`
 * допускают явный `null`, означающий «обнулить значение в БД»
 * (например, при переносе сроков турнира).
 *
 * Семантика null/undefined совпадает с остальными сущностями:
 * `null` и `undefined` трактуются как «поле не передано» на уровне
 * маппера. Репозиторий использует nullsToSql, чтобы превратить
 * `null` в SQL-литерал NULL.
 */
export type UpdateTournamentData = {
  id: string;
} & Partial<Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Фильтры для поиска турниров.
 * Все поля опциональны — комбинируются через AND.
 */
export interface TournamentFilters {
  name?: string; // поиск по подстроке (LIKE %name%)
  season?: string; // точное совпадение
  type?: TournamentType; // точное совпадение
}

// ---------------------------------------------------------------------------
// Тип турнира
// ---------------------------------------------------------------------------

export type TournamentType = 'LEAGUE' | 'CUP' | 'SUPER_CUP';

/**
 * true, если турнир предполагает несколько этапов (группы + плей-офф).
 * Для LEAGUE и SUPER_CUP характерен один этап.
 */
export function isMultiStageTournament(type: TournamentType): boolean {
  return type === 'CUP';
}
