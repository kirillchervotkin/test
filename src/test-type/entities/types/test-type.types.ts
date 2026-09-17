// src/test-types/entities/types/test-type.types.ts

/**
 * Внутреннее представление типа теста.
 *
 * Поле `parameter` хранится в БД явно (NOT NULL) и определяет,
 * какие из failThreshold* заполнены:
 *   - 'time'     → failThresholdTime
 *   - 'segments' → failThresholdSegments
 *   - 'level'    → failThresholdLevel + failThresholdSegments
 *
 * `attemptsCount` актуален только для parameter === 'time'.
 */
export interface TestType {
  id: string;
  name: string;
  gender: string; // 'male' / 'female'
  parameter: TestParameter;
  failThresholdTime: number | null;
  failThresholdLevel: number | null;
  failThresholdSegments: number | null;
  attemptsCount: number | null; // только для parameter === 'time'
}

/**
 * Данные для создания типа теста.
 *
 * Отличается от `TestType` двумя важными моментами:
 *
 *   1. Нет `id` — его генерирует репозиторий.
 *
 *   2. Все `failThreshold*` и `attemptsCount` — ОПЦИОНАЛЬНЫ.
 *      Для каждого `parameter` заполняется только релевантная
 *      группа полей (см. TestTypeMapper.toCreateData):
 *        - time     → failThresholdTime + attemptsCount
 *        - segments → failThresholdSegments
 *        - level    → failThresholdLevel + failThresholdSegments
 *
 *      Нерелевантные поля в объекте ОТСУТСТВУЮТ (не передаются
 *      как null), чтобы Drizzle не включал их в INSERT. Это критично
 *      для YDB: явный `null` в параметрах запроса драйвер пытается
 *      сериализовать как protobuf `null_type`, который YDB не
 *      поддерживает. Если ключа в объекте нет — колонка в SQL
 *      не попадает, и БД подставляет NULL по умолчанию.
 *
 *      `null` в этих полях не допускается на create-пути: у
 *      создаваемой записи ещё нет «старого значения», которое
 *      нужно было бы обнулять. Обнуление — задача update-пути.
 */
export interface CreateTestTypeData {
  name: string;
  gender: string;
  parameter: TestParameter;
  failThresholdTime?: number;
  failThresholdLevel?: number;
  failThresholdSegments?: number;
  attemptsCount?: number;
}

/**
 * Данные для частичного обновления типа теста.
 *
 * Все поля кроме `id` — опциональны. Пороговые поля допускают
 * явный `null`, означающий «обнулить значение в БД» (нужно при
 * смене типа теста, например time → segments).
 *
 * Семантика null/undefined совпадает с DTO-валидатором
 * (`ThresholdCombinationUpdateConstraint`): `null` и `undefined`
 * трактуются одинаково — «поле не передано». Поэтому маппер
 * использует проверку `!= null` и сам решает, какие поля
 * выставить в null для обнуления.
 */
export type UpdateTestTypeData = {
  id: string;
} & Partial<Omit<TestType, 'id'>>;

// ---------------------------------------------------------------------------
// Параметр оценки
// ---------------------------------------------------------------------------

export type TestParameter = 'time' | 'level' | 'segments';

/**
 * Выводит параметр из заполненных полей failThreshold*.
 *
 * Приоритет проверки:
 *   1. failThresholdTime     → 'time'
 *   2. failThresholdLevel    → 'level'
 *   3. иначе                 → 'segments'
 *
 * Используется как fallback/валидация, если parameter не задан явно
 * (например, при парсинге внешних данных до записи в БД).
 *
 * ⚠️ Функция не различает «level без segments» и «только segments» —
 * для level-теста обязательно должны быть заполнены оба поля
 * (failThresholdLevel + failThresholdSegments). Корректность этой
 * комбинации гарантируется DTO-валидатором на входе.
 */
export function resolveParameter(
  t: Pick<
    TestType,
    'failThresholdTime' | 'failThresholdLevel' | 'failThresholdSegments'
  >,
): TestParameter {
  if (t.failThresholdTime != null) return 'time';
  if (t.failThresholdLevel != null) return 'level';
  return 'segments';
}

/**
 * Проверяет, что набор заполненных failThreshold* согласован
 * с явно указанным parameter.
 */
export function isParameterConsistent(
  t: Pick<
    TestType,
    | 'parameter'
    | 'failThresholdTime'
    | 'failThresholdLevel'
    | 'failThresholdSegments'
  >,
): boolean {
  return resolveParameter(t) === t.parameter;
}

/**
 * true, если поле attemptsCount применимо для данного типа теста.
 */
export function supportsAttemptsCount(parameter: TestParameter): boolean {
  return parameter === 'time';
}
