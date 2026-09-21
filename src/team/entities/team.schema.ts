// src/teams/entities/team.schema.ts

import {
  ydbTable,
  uuid,
  text,
  index,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const teams = ydbTable(
  'teams',
  {
    // Первичный ключ — одиночный UUID
    id: uuid('id').primaryKey().notNull(),

    // Полное название команды. Обязательное поле.
    name: text('name').notNull(),

    // Короткое название для UI-таблиц. Опционально.
    shortName: text('short_name'),

    // Домашний город команды. Опциональная ссылка на cities.id.
    // Может быть NULL (например, для сборных).
    cityId: uuid('city_id'),
  },
  (table) => [
    // Индекс для автокомплита и поиска по полному имени.
    index('idx_teams_name').on(table.name),

    // Индекс для поиска по короткому имени (автокомплит).
    index('idx_teams_short_name').on(table.shortName),

    // Индекс для фильтрации команд по домашнему городу.
    index('idx_teams_city').on(table.cityId),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
