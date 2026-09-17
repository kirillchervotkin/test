import {
  ydbTable,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  tableOptions,
  uint32,
} from '@ydbjs/drizzle-adapter/schema';

export const campParticipant = ydbTable(
  'camp_participants',
  {
    campId: uuid('camp_id').notNull(),
    userId: uuid('user_id').notNull(),
    bib: uint32('bib').notNull(),
  },
  (table) => [
    primaryKey(table.campId, table.userId),
    uniqueIndex('idx_camp_bib_unique').on(table.campId, table.bib),
    index('idx_user_id').on(table.userId),
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
