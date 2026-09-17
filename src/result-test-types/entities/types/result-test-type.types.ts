// src/result-test-types/entities/types/result-test-type.types.ts

/**
 * Внутреннее представление связи результата с типом теста (доменная сущность).
 * Используется в репозитории и сервисе.
 */
export interface ResultTestType {
  resultId: string; // внешний ключ на results.id
  testTypeId: string; // внешний ключ на test_types.id
}

/**
 * Данные для создания одной связи.
 * Оба поля обязательны — составной первичный ключ.
 */
export type CreateResultTestTypeData = ResultTestType;
