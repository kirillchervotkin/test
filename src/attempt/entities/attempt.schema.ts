import {
  ydbTable,
  uuid,
  text,
  integer,
  datetime, // <-- импорт datetime
  tableOptions,
  uniqueIndex,
} from '@ydbjs/drizzle-adapter/schema';

export const attempts = ydbTable(
  'attempts',
  {
    id: uuid('id').primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    testType: text('test_type').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    testDate: datetime('test_date').notNull(), // <-- datetime вместо timestamp
    trainingCampId: uuid('training_camp_id').notNull(),
  },
  (table) => [
    uniqueIndex('idx_unique_attempt').on(
      table.userId,
      table.testType,
      table.attemptNumber,
      table.trainingCampId,
    ),
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
