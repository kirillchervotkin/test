// src/results/entities/results.schema.ts

import {
  ydbTable,
  uuid,
  boolean,
  double,
  integer,
  text,
  index,
  uniqueIndex,
  primaryKey,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const results = ydbTable(
  'results',
  {
    // Составной первичный ключ объявлен через primaryKey() ниже.
    //
    // ВАЖНО: id входит в PK последним — это позволяет хранить
    // несколько результатов в одном слоте (user, camp, is_10m, leg).
    // Каждая строка в слоте соответствует своему набору типов тестов
    // через result_test_types (M:N).
    //
    // Порядок полей в primaryKey() выбран так, чтобы PK-префикс
    // покрывал частые запросы:
    //   (user, camp)                          — все результаты пользователя в лагере
    //   (user, camp, is_10m, leg)             — все результаты пользователя в слоте
    //   (user, camp, is_10m, leg, id)         — конкретная строка
    userId: uuid('user_id').notNull(),
    trainingCampId: uuid('training_camp_id').notNull(),
    isTen: boolean('is_10m').notNull(),
    legNumber: integer('leg_number').notNull(),
    id: uuid('id').notNull(), // суррогатный UUID
    // 'pending' | 'completed' | 'not_credited' | 'not_admitted'
    status: text('status').notNull(),
    time: double('time'), // для обычных тестов; NULL для нестандартных
    level: integer('level'), // для теста с уровнем и отрезками
    segments: integer('segments'), // для тестов с отрезками
  },
  (table) => [
    // Составной первичный ключ с id в конце.
    primaryKey(
      table.userId,
      table.trainingCampId,
      table.isTen,
      table.legNumber,
      table.id,
    ),

    // Уникальный индекс на суррогатный id — нужен потому, что
    // в PK он стоит последним, и по нему одному YDB не сможет
    // искать по префиксу. Индекс даёт быстрый доступ «по id».
    uniqueIndex('idx_id').on(table.id),

    // Индексы для выборок
    index('idx_results_camp').on(table.trainingCampId),
    index('idx_results_user').on(table.userId),
    index('idx_results_status').on(table.status),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
