export interface Attempt {
  /** Уникальный идентификатор попытки (UUID) */
  id: string;
  /** Идентификатор пользователя (UUID) */
  userId: string;
  /** Тип теста (например, 'speed', 'endurance') */
  testType: string;
  /** Номер попытки (порядковый номер для данного пользователя и типа теста) */
  attemptNumber: number;
  /** Дата и время проведения теста */
  testDate: Date;
  /** Идентификатор тренировочного лагеря (UUID) */
  trainingCampId: string;
}

/**
 * Данные для создания новой попытки.
 * Все поля обязательны, кроме id (генерируется автоматически).
 */
export type CreateAttemptData = Omit<Attempt, 'id'>;

/**
 * Данные для обновления существующей попытки.
 * Поле id обязательно для идентификации записи, остальные поля опциональны.
 * Поля, не переданные в обновлении, остаются без изменений.
 */
export type UpdateAttemptData = {
  id: string;
} & Partial<Omit<Attempt, 'id'>>;
