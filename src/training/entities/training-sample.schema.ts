// src/training/entities/training-sample.schema.ts
import {
  ydbTable,
  text,
  uint16,
  binary,
  primaryKey,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

/**
 * Типизированные блобы сэмплов.
 *
 * Одна строка на (тренировка, тип сэмпла).
 *
 * Формат блоба зависит от типа (см. codec/samples-codec.ts):
 *   Uint8   — hr, cadence, temperature
 *   Uint16  — power, distance
 *   Float32 — speed, altitude
 */
export const trainingSamples = ydbTable(
  'training_samples',
  {
    sessionId: text('session_id').notNull(), // = training_sessions.id
    sampleType: text('sample_type').notNull(), // 'hr', 'speed', 'power', ...
    intervalSec: uint16('interval_sec').notNull(), // recording-rate
    samples: binary('samples').notNull(), // бинарный блоб
  },
  (table) => [
    primaryKey(table.sessionId, table.sampleType),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
