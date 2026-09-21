// src/matches/entities/types/match.types.ts

/**
 * Внутреннее представление матча (доменная сущность).
 * Используется в репозитории и сервисе.
 *
 * Матч всегда привязан к этапу через `stageId`. Этап определяет,
 * круговой это матч (с туром) или плей-офф (без тура).
 *
 * Поля:
 *   - `tournamentId` — турнир, к которому относится матч.
 *     Выводится из `stage.tournamentId` при создании (в репозитории,
 *     в одной транзакции с INSERT).
 *   - `stageId` — этап (группа или раунд).
 *   - `tourNumber` — номер тура. Заполнен для матчей кругового
 *     этапа (ROUND_ROBIN), NULL для плей-офф (ELIMINATION).
 *   - `matchDate` — дата и время матча.
 *   - `cityId` — город проведения.
 *   - `homeTeamId` / `awayTeamId` — команды. NULL для матчей
 *     плей-офф, участники которых определяются по результатам
 *     групп. Заполняются позже через PATCH.
 *   - `homeScore` / `awayScore` — счёт. NULL, пока матч не сыгран.
 */
export interface Match {
  id: string;
  tournamentId: string;
  stageId: string;
  tourNumber: number | null;
  matchDate: Date;
  cityId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeScore: number | null;
  awayScore: number | null;
}

/**
 * Матч с деталями: имена команд, города и этапа.
 * Возвращается из JOIN-запросов для отображения.
 *
 * Используется в `MatchCrewController: GET /matches/:id/crew`.
 * Репозиторий назначений читает схему `matches` напрямую и
 * собирает этот объект — модуль assignments не зависит
 * от MatchModule (только type-only импорт этого типа).
 *
 * Поля:
 *   - `homeTeamName` / `awayTeamName` — nullable, потому что
 *     у матчей плей-офф команды могут быть ещё не определены.
 *   - `cityName` / `stageName` — не nullable, потому что
 *     `cityId` и `stageId` у матча обязательные (NOT NULL).
 */
export interface MatchWithDetails extends Match {
  homeTeamName: string | null;
  awayTeamName: string | null;
  cityName: string;
  stageName: string;
}

/**
 * Данные для создания матча.
 *
 * Отличается от `Match`:
 *   1. Нет `id` — его генерирует репозиторий (uuidv4).
 *   2. `tournamentId` присутствует, но НЕ приходит от клиента:
 *      выводится в репозитории из `stage.tournamentId`.
 *      На уровне API используется {@link CreateMatchInput} —
 *      тот же тип без `tournamentId`.
 *   3. `tourNumber`, `homeTeamId`, `awayTeamId` — ОПЦИОНАЛЬНЫ.
 *   4. `homeScore` / `awayScore` отсутствуют — матч создаётся
 *      непосчитанным.
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
export interface CreateMatchData {
  tournamentId: string;
  stageId: string;
  matchDate: Date;
  cityId: string;
  tourNumber?: number;
  homeTeamId?: string;
  awayTeamId?: string;
}

/**
 * Данные для частичного обновления матча.
 *
 * Все поля кроме `id` — опциональны. `tourNumber`, `homeTeamId`,
 * `awayTeamId`, `homeScore`, `awayScore` допускают явный `null`,
 * означающий «обнулить значение в БД».
 *
 * Семантика `undefined` vs `null` здесь РАЗНАЯ:
 *   - `undefined` — поле не передано, не трогаем в БД.
 *   - `null` — явное «обнулить». Поле попадает в объект
 *     со значением `null`, а репозиторий через nullsToSql
 *     превратит его в SQL-литерал NULL (не в bind-параметр).
 *
 * Примеры:
 *   PATCH /matches/:id { homeTeamId: null }   → убрать хозяев
 *   PATCH /matches/:id { homeScore: null }    → сбросить счёт
 *   PATCH /matches/:id { tourNumber: null }   → убрать номер тура
 *
 * `tournamentId` и `stageId` не меняются: перенос матча между
 * турнирами/этапами — это delete + create.
 */
export type UpdateMatchData = {
  id: string;
} & Partial<Omit<Match, 'id' | 'tournamentId' | 'stageId'>>;

/**
 * Фильтры для поиска матчей.
 * Все поля опциональны — комбинируются через AND.
 */
export interface MatchFilters {
  tournamentId?: string;
  stageId?: string;
  cityId?: string;
  teamId?: string; // матчи, где команда home ИЛИ away
  tourNumber?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Вход для создания матча со стороны API / сервиса.
 *
 * Отличается от {@link CreateMatchData} отсутствием `tournamentId`:
 * он НЕ приходит от клиента. Вместо этого репозиторий сам читает
 * `stages` напрямую через Drizzle (схема уже импортирована для
 * `readStageContext`), извлекает `tournamentId` и `format` из
 * одной строки, проверяет согласованность `tourNumber ↔ format`
 * и только после этого делает INSERT — всё в одной транзакции.
 *
 * Это гарантирует:
 *   - согласованность `stage ↔ tournament` by design (оба значения
 *     берутся из одной строки stages, нечего проверять);
 *   - проверку `tourNumber ↔ format` в том же снапшоте, что и запись;
 *   - отсутствие гонок между чтением stage и записью матча.
 */
export type CreateMatchInput = Omit<CreateMatchData, 'tournamentId'>;

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/**
 * true, если матч относится к плей-офф (без тура).
 *
 * Используется для проверки согласованности `tourNumber` ↔
 * `stage.format`: для ROUND_ROBIN должен быть заполнен tourNumber,
 * для ELIMINATION — нет.
 */
export function isPlayoffMatch(match: Pick<Match, 'tourNumber'>): boolean {
  return match.tourNumber === null;
}

/**
 * true, если матч ещё не сыгран (счёт не проставлен).
 *
 * Оба гола NULL — матч в статусе «запланирован». Если хотя бы
 * один заполнен — счёт считается проставленным.
 */
export function isUnplayed(
  match: Pick<Match, 'homeScore' | 'awayScore'>,
): boolean {
  return match.homeScore === null && match.awayScore === null;
}

/**
 * true, если обе команды определены (актуально для плей-офф,
 * где команды появляются позже).
 *
 * Используется для фильтра «только матчи с известными участниками»
 * или для проверки готовности матча к публикации.
 */
export function hasBothTeams(
  match: Pick<Match, 'homeTeamId' | 'awayTeamId'>,
): boolean {
  return match.homeTeamId !== null && match.awayTeamId !== null;
}
