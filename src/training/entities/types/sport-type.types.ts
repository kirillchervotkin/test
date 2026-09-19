// src/training/entities/types/sport-type.types.ts

/**
 * Внутреннее представление вида спорта из справочника.
 *
 * Таблица `sport_types` — плоский справочник, редко меняется.
 * PK — `code` (одна колонка, без составного ключа).
 *
 * В `training_sessions.sport` хранится именно `code`,
 * а `displayRu`/`displayEn` используются только для отображения.
 */
export interface SportType {
  code: string; // 'running', 'cycling', ...
  displayRu: string; // 'Бег', 'Велосипед', ...
  displayEn: string; // 'Running', 'Cycling', ...
}

/**
 * Данные для создания записи справочника.
 *
 * Отличается от `SportType` только семантически: сейчас
 * справочник заполняется через seed-скрипт, а не через API.
 * Тип оставлен как заготовка на случай админ-эндпоинта
 * или добавления новых видов спорта в рантайме.
 *
 * Объявлен через `type`, а не `interface`, потому что Drizzle
 * ожидает `InsertValues` — generic с неявной index signature.
 * `interface` её не имеет, `type` — имеет. Это правило касается
 * всех Create-типов, которые попадают в `.values(...)`.
 */
export type CreateSportTypeData = {
  code: string;
  displayRu: string;
  displayEn: string;
};

/**
 * Данные для частичного обновления записи справочника.
 *
 * `code` не обновляется — это PK. Если нужно переименовать код,
 * это делается через DELETE + INSERT (или обновление
 * `training_sessions.sport` отдельным скриптом миграции).
 *
 * Все поля опциональны. Отсутствие ключа — «не трогать».
 * `null` не допускается: display-поля обязательны (NOT NULL
 * в схеме).
 *
 * `type`, а не `interface` — по той же причине, что и
 * CreateSportTypeData: совместимость с Drizzle в `.set(...)`.
 */
export type UpdateSportTypeData = {
  displayRu?: string;
  displayEn?: string;
};
