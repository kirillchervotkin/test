// src/training/entities/sport-type.schema.ts
import { ydbTable, text, tableOptions } from '@ydbjs/drizzle-adapter/schema';

export const sportTypes = ydbTable(
  'sport_types',
  {
    code: text('code').primaryKey().notNull(),
    displayRu: text('display_ru').notNull(),
    displayEn: text('display_en').notNull(),
  },
  () => [
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
