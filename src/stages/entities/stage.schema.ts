// src/stages/entities/stage.schema.ts

import {
  ydbTable,
  uuid,
  text,
  uint32,
  json,
  timestamp,
  index,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const stages = ydbTable(
  'stages',
  {
    // Первичный ключ — одиночный UUID
    id: uuid('id').primaryKey().notNull(),

    // Внешняя ссылка на tournaments.id (FK не enforced на уровне YDB)
    tournamentId: uuid('tournament_id').notNull(),

    // Самоссылка: NULL для корневых этапов
    parentStageId: uuid('parent_stage_id'),

    // Отображаемое имя: 'Группа A', '1/4 финала', 'Групповой этап'
    name: text('name').notNull(),

    // Тип этапа: 'STAGE' | 'GROUP' | 'ROUND' | 'PLAYOFF'
    type: text('type').notNull(),

    // Формат игры: 'ROUND_ROBIN' | 'ELIMINATION' | null (для контейнеров)
    format: text('format'),

    // Порядок среди соседей (для сортировки в UI и при генерации)
    sortOrder: uint32('sort_order').notNull().default(0),

    // Гибкие параметры этапа (очки, тай-брейки, правила обмена).
    // Читается целиком, поиск по внутренним полям не предполагается.
    settings: json('settings'),

    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('idx_stages_tournament').on(table.tournamentId),
    index('idx_stages_parent').on(table.parentStageId),
    index('idx_stages_type').on(table.type),
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
