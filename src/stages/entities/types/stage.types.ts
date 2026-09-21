// src/stages/entities/types/stage.types.ts

/**
 * Внутреннее представление этапа турнира (доменная сущность).
 * Используется в репозитории и сервисе.
 *
 * Этап — это узел дерева структуры турнира. Бывает:
 *   - STAGE      — контейнер верхнего уровня («Групповой этап»)
 *   - GROUP      — конкретная группа внутри этапа
 *   - ROUND      — раунд плей-офф (1/4, 1/2, финал)
 *   - PLAYOFF    — контейнер для плей-офф целиком
 *
 * Поле `format` определяет, как играется этап:
 *   - 'ROUND_ROBIN' — круговой (матчи с турами)
 *   - 'ELIMINATION' — олимпийская система (матчи без туров)
 *   - null          — контейнер (нет матчей напрямую)
 *
 * Иерархия строится через `parentStageId`: дочерние этапы ссылаются
 * на родительский. Корневые этапы имеют `parentStageId = null`.
 *
 * `settings` — гибкие параметры конкретного этапа (очки за победу,
 * тай-брейки, количество кругов, правила обмена между группами).
 * Хранится как Json и читается целиком, без поиска по внутренним
 * полям. Для YDB это критично: тип Json не поддерживает фильтрацию
 * по равенству целого объекта, но чтение целиком работает.
 */
export interface Stage {
  id: string;
  tournamentId: string;
  parentStageId: string | null;
  name: string; // 'Группа A', '1/4 финала'
  type: StageType;
  format: StageFormat | null;
  sortOrder: number; // порядок среди соседей
  settings: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Данные для создания этапа.
 *
 * Отличается от `Stage`:
 *   1. Нет `id` — его генерирует репозиторий (uuidv4).
 *   2. Нет `createdAt` / `updatedAt` — их проставляет репозиторий.
 *   3. `sortOrder` опционален — по умолчанию 0.
 *   4. `parentStageId`, `format`, `settings` — опциональны.
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
export interface CreateStageData {
  tournamentId: string;
  parentStageId?: string;
  name: string;
  type: StageType;
  format?: StageFormat;
  sortOrder?: number;
  settings?: Record<string, unknown>;
}

/**
 * Данные для частичного обновления этапа.
 *
 * Все поля кроме `id` — опциональны. `parentStageId`, `format` и
 * `settings` допускают явный `null`, означающий «обнулить значение
 * в БД»:
 *   - `parentStageId: null` — сделать этап корневым;
 *   - `format: null` — превратить этап в контейнер;
 *   - `settings: null` — очистить настройки.
 *
 * Семантика `undefined` vs `null` РАЗНАЯ:
 *   - `undefined` — поле не передано, не трогаем в БД.
 *   - `null` — явное «обнулить». Репозиторий через nullsToSql
 *     превратит его в SQL-литерал NULL (не в bind-параметр).
 *
 * `tournamentId` не входит в патч: перенос этапа в другой турнир —
 * это delete + create. `createdAt` / `updatedAt` — служебные,
 * их проставляет репозиторий.
 */
export type UpdateStageData = {
  id: string;
} & Partial<Omit<Stage, 'id' | 'tournamentId' | 'createdAt' | 'updatedAt'>>;

// ---------------------------------------------------------------------------
// Типы этапов
// ---------------------------------------------------------------------------

/**
 * Тип этапа:
 *   - STAGE   — контейнер верхнего уровня («Групповой этап»)
 *   - GROUP   — конкретная группа внутри этапа
 *   - ROUND   — раунд плей-офф (1/4, 1/2, финал)
 *   - PLAYOFF — контейнер для плей-офф целиком
 */
export type StageType = 'STAGE' | 'GROUP' | 'ROUND' | 'PLAYOFF';

/**
 * Формат игры этапа:
 *   - ROUND_ROBIN — круговой (матчи с турами)
 *   - ELIMINATION — олимпийская система (матчи без туров)
 *
 * null означает, что этап — контейнер и матчей напрямую не содержит.
 */
export type StageFormat = 'ROUND_ROBIN' | 'ELIMINATION';

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/**
 * true, если этап — контейнер (не содержит матчей напрямую).
 *
 * Контейнеры: STAGE и PLAYOFF. У них `format = null`, и матчи
 * привязаны не к ним, а к дочерним этапам (группам или раундам).
 */
export function isContainerStage(stage: Pick<Stage, 'format'>): boolean {
  return stage.format === null;
}

/**
 * true, если матчи этапа имеют номера туров (круговой формат).
 *
 * Используется при генерации календаря: для ROUND_ROBIN матчи
 * получают tourNumber, для ELIMINATION — нет.
 */
export function hasTours(stage: Pick<Stage, 'format'>): boolean {
  return stage.format === 'ROUND_ROBIN';
}

/**
 * true, если матчи этапа — это раунды плей-офф (без туров).
 */
export function hasRounds(stage: Pick<Stage, 'format'>): boolean {
  return stage.format === 'ELIMINATION';
}

/**
 * Проверяет согласованность `type` и `format`.
 *
 * Инварианты:
 *   - STAGE / PLAYOFF  → format === null (контейнер)
 *   - GROUP            → format === 'ROUND_ROBIN'
 *   - ROUND            → format === 'ELIMINATION'
 *
 * Используется в сервисном слое для проверки после слияния патча
 * с текущим состоянием сущности (DTO такой проверки сделать не может,
 * потому что не видит текущего `type` при частичном обновлении).
 */
export function isTypeFormatConsistent(
  stage: Pick<Stage, 'type' | 'format'>,
): boolean {
  if (stage.type === 'STAGE' || stage.type === 'PLAYOFF') {
    return stage.format === null;
  }
  if (stage.type === 'GROUP') {
    return stage.format === 'ROUND_ROBIN';
  }
  if (stage.type === 'ROUND') {
    return stage.format === 'ELIMINATION';
  }
  return false;
}
