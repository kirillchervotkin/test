// src/cities/entities/types/city.types.ts

/**
 * Внутреннее представление города (доменная сущность).
 * Используется в репозитории и сервисе.
 *
 * Город — глобальный справочник. Не привязан к турниру,
 * не имеет иерархии. Используется в матчах (`matches.city_id`)
 * для указания места проведения.
 *
 * Поле `region` — опциональное. Хранит регион/область/край,
 * к которому относится город. Может быть NULL, если регион
 * не указан.
 */
export interface City {
  id: string;
  name: string;
  region: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Данные для создания города.
 *
 * Отличается от `City`:
 *   1. Нет `id` — его генерирует репозиторий (uuidv4).
 *   2. Нет `createdAt` / `updatedAt` — их проставляет репозиторий.
 *   3. `region` — ОПЦИОНАЛЕН.
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
export interface CreateCityData {
  name: string;
  region?: string;
}

/**
 * Данные для частичного обновления города.
 *
 * Все поля кроме `id` — опциональны. `region` допускает явный
 * `null`, означающий «обнулить значение в БД».
 *
 * Семантика `undefined` vs `null` здесь РАЗНАЯ:
 *   - `undefined` — поле не передано, не трогаем в БД.
 *   - `null` — явное «обнулить». Поле попадает в объект
 *     со значением `null`, а репозиторий через nullsToSql
 *     превратит его в SQL-литерал NULL (не в bind-параметр).
 *
 * Пример:
 *   PATCH /cities/:id { region: null }  → очистить регион
 *
 * `createdAt` / `updatedAt` — служебные, их проставляет репозиторий.
 */
export type UpdateCityData = {
  id: string;
} & Partial<Omit<City, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Фильтры для поиска городов.
 * Все поля опциональны — комбинируются через AND.
 */
export interface CityFilters {
  name?: string; // поиск по подстроке (LIKE %name%)
  region?: string; // точное совпадение
}
