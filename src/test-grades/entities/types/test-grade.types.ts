// src/test-grades/entities/types/test-grade.types.ts

/**
 * Внутреннее представление градации теста (доменная сущность).
 * Используется в репозитории и сервисе.
 *
 * Градация привязана к конкретному типу теста (test_type_id) и
 * уникальна в его пределах — это гарантируется составным первичным
 * ключом (test_type_id, grade).
 *
 * Поле color — цвет градации (HEX, например "#FFFFFF"),
 * используется для UI-отображения.
 */
export interface TestGrade {
  id: string; // суррогатный UUID (уникальный индекс idx_id)
  testTypeId: string; // внешний ключ на test_types
  grade: string; // название градации (A, B, C, …) — часть PK
  threshold: number; // порог для градации
  color: string; // цвет градации в HEX, по умолчанию "#FFFFFF"
}

/**
 * Данные для создания градации (передаются в репозиторий).
 * Все поля обязательны, кроме id (генерируется автоматически).
 */
export type CreateTestGradeData = Omit<TestGrade, 'id'>;

/**
 * Данные для обновления градации (передаются в репозиторий).
 * id обязателен, остальные поля опциональны.
 */
export type UpdateTestGradeData = {
  id: string;
} & Partial<Omit<TestGrade, 'id'>>;
