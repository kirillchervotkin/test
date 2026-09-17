// src/results/entities/types/result.types.ts

/**
 * Статус результата.
 *
 *   - 'completed'    — тест выполнен, результат зачтён (обычный случай);
 *   - 'not_credited' — тест выполнен, но результат не зачтён по технической
 *                      причине (ошибка оборудования, помешал соперник и т.п.);
 *   - 'not_admitted' — спортсмен не допущен к тесту, результат отсутствует.
 *
 * Значения взаимоисключающие. Новые статусы добавляются сюда и в
 * RESULT_STATUSES ниже — единый источник правды для валидации DTO
 * и Swagger.
 */
export type ResultStatus = 'completed' | 'not_credited' | 'not_admitted';

/**
 * Runtime-список статусов для @IsIn(...) и Swagger enum.
 * Держать в одном месте, чтобы не дублировать в DTO и доке.
 */
export const RESULT_STATUSES: readonly ResultStatus[] = [
  'completed',
  'not_credited',
  'not_admitted',
] as const;

/**
 * Внутреннее представление результата (доменная сущность).
 * Используется в репозитории и сервисе.
 *
 * Согласованность `status` ↔ метрики:
 *   - 'completed'    → хотя бы одна из time / level / segments заполнена;
 *   - 'not_credited' → метрики могут быть заполнены или пусты;
 *   - 'not_admitted' → все метрики NULL.
 *
 * Тип теста (или несколько) хранится отдельно — в таблице
 * result_test_types (связь многие-ко-многим).
 */
export interface Result {
  id: string;
  userId: string;
  trainingCampId: string;
  isTen: boolean;
  legNumber: number;
  status: ResultStatus;
  time: number | null;
  level: number | null;
  segments: number | null;
}

/**
 * Данные для создания результата (передаются в репозиторий).
 * Все поля обязательны, кроме id (генерируется автоматически).
 */
export type CreateResultData = Omit<Result, 'id'>;

/**
 * Данные для обновления результата (передаются в репозиторий).
 *
 * id обязателен.
 * Разрешены к изменению только «метрики» и статус — всё остальное
 * (userId, trainingCampId, isTen, legNumber) входит в PRIMARY KEY
 * и меняться не может.
 */
export type UpdateResultData = {
  id: string;
} & Partial<Pick<Result, 'status' | 'time' | 'level' | 'segments'>>;

/**
 * Композиция «результат + привязанные типы тестов».
 *
 * Используется на уровне сервиса и контроллера: отдаётся наружу
 * как единый объект, хотя в БД `Result` и `testTypeIds` лежат
 * в разных таблицах (results и result_test_types, связь M:N).
 *
 * В репозитории не используется — там работают с чистым `Result`.
 */
export interface ResultWithLinks {
  result: Result;
  testTypeIds: string[];
}
