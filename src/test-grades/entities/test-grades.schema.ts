// src/test-grades/entities/test-grades.schema.ts

import {
  ydbTable,
  uuid,
  text,
  double,
  uniqueIndex,
  primaryKey,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const testGrades = ydbTable(
  'test_grades',
  {
    // Составной первичный ключ объявлен через primaryKey() ниже
    testTypeId: uuid('test_type_id').notNull(),
    grade: text('grade').notNull(),
    id: uuid('id').notNull(), // суррогатный UUID с уникальным индексом
    threshold: double('threshold').notNull(),
    color: text('color').notNull().default('#FFFFFF'),
  },
  (table) => [
    // Составной первичный ключ
    primaryKey(table.testTypeId, table.grade),

    // Уникальный индекс на суррогатный id
    uniqueIndex('idx_id').on(table.id),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
