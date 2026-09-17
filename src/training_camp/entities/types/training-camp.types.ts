// src/training-camps/types/training-camp.types.ts

/**
 * Внутреннее представление тренировочного лагеря (доменная сущность).
 * Используется в репозитории и сервисе.
 */
export interface TrainingCamp {
  id: string;
  name: string;
  description: string | null; // NULL в БД → null
  startDate: Date;
  endDate: Date;
  location: string | null; // NULL в БД → null
  isActive: boolean;
}

/**
 * Данные для создания тренировочного лагеря (передаются в репозиторий).
 * Все необязательные поля – `?:` (без null).
 * При отсутствии поля оно не попадает в INSERT → БД ставит NULL.
 */
export type CreateTrainingCampData = {
  name: string;
  startDate: Date;
  endDate: Date;
  description?: string; // опционально → NULL в БД
  location?: string; // опционально → NULL в БД
  isActive?: boolean; // опционально → по умолчанию true (задаётся в коде)
};

/**
 * Данные для обновления тренировочного лагеря (передаются в репозиторий).
 * Все поля опциональны (кроме id) и могут быть null для явного сброса.
 */
export type UpdateTrainingCampData = {
  id: string;
} & Partial<Omit<TrainingCamp, 'id'>>;
