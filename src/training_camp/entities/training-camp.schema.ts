// src/training-camps/entities/training-camp.schema.ts

import {
  ydbTable,
  uuid,
  text,
  boolean,
  date, // Обратите внимание - теперь импортируем date вместо timestamp
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

// ============================================================
// СХЕМА ТАБЛИЦЫ TRAINING_CAMPS
// ============================================================
export const trainingCamps = ydbTable(
  'training_camps',
  {
    id: uuid('id').primaryKey().notNull(),
    name: text('name').notNull(),
    description: text('description'),
    // Заменяем timestamp на date
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    location: text('location'),
    isActive: boolean('is_active').notNull().default(true),
  },
  () => [
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
