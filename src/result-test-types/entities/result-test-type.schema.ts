// src/result-test-types/entities/result-test-type.schema.ts

import {
  ydbTable,
  uuid,
  index,
  primaryKey,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const resultTestTypes = ydbTable(
  'result_test_types',
  {
    resultId: uuid('result_id').notNull(),
    testTypeId: uuid('test_type_id').notNull(),
  },
  (table) => [
    // Составной первичный ключ
    primaryKey(table.resultId, table.testTypeId),

    // Индексы
    index('idx_result').on(table.resultId),
    index('idx_test_type').on(table.testTypeId),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
