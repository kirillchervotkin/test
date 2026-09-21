import {
  ydbTable,
  uuid,
  text,
  date,
  timestamp,
  index,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const tournaments = ydbTable(
  'tournaments',
  {
    id: uuid('id').primaryKey().notNull(),
    name: text('name').notNull(),
    season: text('season').notNull(), // '2023/24'
    type: text('type').notNull(), // 'LEAGUE' | 'CUP' | 'SUPER_CUP'
    startDate: date('start_date'),
    endDate: date('end_date'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull(),
  },
  (table) => [
    index('idx_tournaments_season').on(table.season),
    index('idx_tournaments_type').on(table.type),
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
