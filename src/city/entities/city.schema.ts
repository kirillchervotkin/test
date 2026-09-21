// src/cities/entities/city.schema.ts

import {
  ydbTable,
  uuid,
  text,
  timestamp,
  index,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const cities = ydbTable(
  'cities',
  {
    // Первичный ключ — одиночный UUID
    id: uuid('id').primaryKey().notNull(),

    // Название города. Обязательное поле.
    name: text('name').notNull(),

    // Регион/область/край. Опционально — может быть NULL.
    region: text('region'),

    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    // Индекс для поиска по имени (автокомплит, LIKE %query%).
    index('idx_cities_name').on(table.name),

    // Индекс для фильтрации по региону (точное совпадение).
    index('idx_cities_region').on(table.region),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
