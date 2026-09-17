// src/test-types/entities/test-type.schema.ts

import {
  ydbTable,
  uuid,
  text,
  double,
  integer,
  uint32,
  uniqueIndex,
  index,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const testTypes = ydbTable(
  'test_types',
  {
    id: uuid('id').primaryKey().notNull(),
    name: text('name').notNull(),
    gender: text('gender').notNull(), // 'male' / 'female'
    parameter: text('parameter').notNull(),
    failThresholdTime: double('fail_threshold_time'), // для time-теста
    failThresholdLevel: double('fail_threshold_level'), // для level-теста (вещественный)
    failThresholdSegments: integer('fail_threshold_segments'), // для segments и level
    attemptsCount: uint32('attempts_count'), // кол-во попыток (только для тестов со временем)
  },
  (table) => [
    uniqueIndex('idx_name').on(table.name),
    index('idx_gender').on(table.gender),
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
