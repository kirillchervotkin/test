// src/training/entities/training-session.schema.ts
import {
  ydbTable,
  text,
  timestamp,
  uint32,
  uint16,
  double,
  index,
  primaryKey,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const trainingSessions = ydbTable(
  'training_sessions',
  {
    // Составной первичный ключ — через primaryKey() ниже
    userId: text('user_id').notNull(),
    provider: text('provider').notNull(), // 'polar', 'suunto'
    externalId: text('external_id').notNull(),

    // Детерминированный хеш от (user_id, provider, external_id),
    // используется как ссылка в training_samples.session_id
    id: text('id').notNull(),
    startTime: timestamp('start_time').notNull(),
    durationSec: uint32('duration_sec').notNull(),
    sport: text('sport'), // нормализованный код

    distanceM: double('distance_m'),
    calories: uint32('calories'),
    hrAvg: uint16('hr_avg'),
    hrMax: uint16('hr_max'),
    hrMin: uint16('hr_min'),

    ascentM: double('ascent_m'),
    descentM: double('descent_m'),

    name: text('name'),
    notes: text('notes'),
  },
  (table) => [
    // Составной первичный ключ
    primaryKey(table.userId, table.provider, table.externalId),

    // Глобальный индекс для чтения списка тренировок пользователя
    // за период. В YDB это GLOBAL INDEX; адаптер создаёт его по умолчанию.
    //
    // Если адаптер поддерживает COVER-колонки, добавь их, чтобы запрос
    // не ходил в основную таблицу:
    //   .cover(
    //     table.id,
    //     table.durationSec, table.sport,
    //     table.distanceM, table.calories,
    //     table.hrAvg, table.hrMax, table.hrMin,
    //     table.ascentM, table.descentM,
    //     table.name, table.notes,
    //   )
    //
    // provider и external_id в COVER не включаем — они уже в PK.
    index('idx_start_time').on(table.userId, table.startTime),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
