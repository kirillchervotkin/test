// src/training/entities/types/training-samples.types.ts
/**
 * Внутреннее представление блоба сэмплов.
 *
 * Одна строка на (тренировка, тип сэмпла). Блоб — бинарный,
 * формат зависит от типа (см. SampleType и SAMPLE_ENCODING ниже).
 *
 * PK составной: (sessionId, sampleType). Вторичных индексов нет —
 * чтение всегда идёт по `sessionId`, а он в PK первым.
 */
export interface TrainingSample {
  sessionId: string; // = training_sessions.id
  sampleType: SampleType;
  intervalSec: number; // recording-rate провайдера
  samples: Buffer; // бинарный блоб, little-endian
}

/**
 * Данные для upsert одного типа сэмплов.
 *
 * `intervalSec` — интервал между точками в секундах. У разных
 * типов он может отличаться (например, hr — каждые 5 сек,
 * cadence — каждую 1 сек). Хранится в строке, а не в сессии,
 * именно из-за этого.
 *
 * `values` — массив чисел в порядке возрастания времени.
 * Упаковка в блоб выполняется codec'ом, не репозиторием.
 */
export interface CreateTrainingSampleData {
  sessionId: string;
  sampleType: SampleType;
  intervalSec: number;
  values: number[];
}

/**
 * Входной набор сэмплов для сохранения тренировки.
 *
 * Отличается от `CreateTrainingSampleData` тем, что не содержит
 * `sessionId`: на момент формирования набора сессия ещё не создана.
 * sessionId подставляется внутри `TrainingRepository`, когда
 * `upsertSamples` вызывается после `upsertSession`.
 *
 * `type`, а не `interface` — по той же причине, что и остальные
 * Create-типы: совместимость с Drizzle в `.values(...)`.
 */
export type SampleInput = {
  sampleType: SampleType;
  intervalSec: number;
  values: number[];
};

/**
 * Данные для upsert сразу нескольких типов в одной транзакции.
 *
 * Используется при обработке тренировки: все блобы пишутся
 * одной транзакцией, чтобы не делать N round-trip'ов к YDB.
 */
export interface CreateTrainingSamplesBatchData {
  sessionId: string;
  samples: Array<{
    sampleType: SampleType;
    intervalSec: number;
    values: number[];
  }>;
}

// ---------------------------------------------------------------------------
// Типы сэмплов
// ---------------------------------------------------------------------------

/**
 * Нормализованные типы сэмплов.
 *
 * Маппинг числовых кодов провайдеров (например, у Polar
 * sample-type "1" = HR, "2" = speed) в эти строки — задача
 * адаптера.
 *
 * Набор НЕ закрытый: новый тип = новая строка в union + ветка
 * в packSamples/unpackSamples. Миграция БД не требуется, потому
 * что `sample_type` — Utf8.
 */
export type SampleType =
  | 'hr'
  | 'speed'
  | 'power'
  | 'cadence'
  | 'altitude'
  | 'distance'
  | 'temperature';

/**
 * Кодировка значения в блобе для конкретного типа сэмпла.
 *
 *   Uint8   — 1 байт на точку, диапазон 0..255
 *   Uint16  — 2 байта, 0..65535
 *   Float32 — 4 байта, IEEE 754, little-endian
 *
 * Выбор основан на физических диапазонах:
 *   - hr, cadence, temperature — 0..255 с запасом;
 *   - power, distance — до 65 535 (Вт / метров);
 *   - speed, altitude — могут быть дробными и/или
 *     отрицательными, поэтому Float32.
 */
export type SampleEncoding = 'u8' | 'u16' | 'f32';

/**
 * Соответствие типа сэмпла и его кодировки.
 *
 * Если добавляешь новый SampleType — добавь запись сюда.
 * TypeScript проверит полноту через Record<SampleType, ...>.
 */
export const SAMPLE_ENCODING: Record<SampleType, SampleEncoding> = {
  hr: 'u8',
  cadence: 'u8',
  temperature: 'u8',
  power: 'u16',
  distance: 'u16',
  speed: 'f32',
  altitude: 'f32',
};

// ---------------------------------------------------------------------------
// Хелперы над типами
// ---------------------------------------------------------------------------

/**
 * Сколько байт занимает одна точка для данного типа.
 * Используется при валидации длины блоба при чтении из БД.
 */
export function bytesPerSample(type: SampleType): number {
  switch (SAMPLE_ENCODING[type]) {
    case 'u8':
      return 1;
    case 'u16':
      return 2;
    case 'f32':
      return 4;
    default: {
      const _exhaustive: never = SAMPLE_ENCODING[type];
      throw new Error(`Unsupported sample encoding: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Проверяет, что длина блоба кратна размеру точки.
 * Полезно при чтении из БД, если данные могли быть
 * повреждены.
 */
export function isValidBlobLength(
  type: SampleType,
  byteLength: number,
): boolean {
  return byteLength % bytesPerSample(type) === 0;
}

// ---------------------------------------------------------------------------
// Codec: упаковка / распаковка блобов
// ---------------------------------------------------------------------------

/**
 * Упаковывает массив значений в бинарный блоб.
 *
 * Формат зависит от типа сэмпла (см. SAMPLE_ENCODING):
 *   Uint8   — 1 байт на точку, диапазон 0..255
 *   Uint16  — 2 байта, 0..65535
 *   Float32 — 4 байта, IEEE 754, little-endian
 *
 * Для u8 и u16 значения клампятся в допустимый диапазон — это
 * защищает от мусора, пришедшего от провайдера (например,
 * bpm = 300 при битом датчике). Обрезаем точку, а не весь блоб.
 *
 * NaN и ±Infinity не пройдут через кламп корректно (Math.round
 * вернёт NaN, а Uint8Array присвоит его как 0), поэтому такие
 * значения трактуются как 0. Это осознанный выбор: лучше
 * записать 0 в одну точку, чем уронить упаковку всего блоба.
 *
 * ВАЖНО: little-endian обязателен для совместимости с
 * unpackSamples и с любым внешним потребителем блоба
 * (например, фронтом, который декодирует base64 в DataView).
 */
export function packSamples(type: SampleType, values: number[]): Buffer {
  const enc = SAMPLE_ENCODING[type];

  switch (enc) {
    case 'u8': {
      const buf = Buffer.alloc(values.length);
      for (let i = 0; i < values.length; i++) {
        const v: number = values[i];
        buf[i] = clampU8(v);
      }
      return buf;
    }
    case 'u16': {
      const buf = Buffer.alloc(values.length * 2);
      for (let i = 0; i < values.length; i++) {
        const v: number = values[i];
        buf.writeUInt16LE(clampU16(v), i * 2);
      }
      return buf;
    }
    case 'f32': {
      const buf = Buffer.alloc(values.length * 4);
      for (let i = 0; i < values.length; i++) {
        const v: number = values[i];
        // NaN/Infinity пропускаем как 0 — иначе writeFloatLE
        // запишет их байтовое представление, и потребитель
        // блоба (фронт) получит NaN в графике.
        buf.writeFloatLE(Number.isFinite(v) ? v : 0, i * 4);
      }
      return buf;
    }
    default: {
      const _exhaustive: never = enc;
      throw new Error(`Unsupported sample encoding: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Распаковывает блоб в массив чисел.
 *
 * Интервал между точками берётся из колонки interval_sec и
 * применяется на стороне отображения. Здесь его нет — функция
 * работает только с массивом значений.
 *
 * Если длина блоба не кратна размеру точки (повреждение данных,
 * оборванная запись) — бросаем. Лучше упасть громко, чем вернуть
 * массив с «висячим» последним байтом.
 */
export function unpackSamples(type: SampleType, blob: Buffer): number[] {
  const enc = SAMPLE_ENCODING[type];

  switch (enc) {
    case 'u8': {
      return Array.from(blob);
    }
    case 'u16': {
      if (blob.length % 2 !== 0) {
        throw new Error(
          `Invalid u16 blob length ${blob.length} for sample type ${type}`,
        );
      }
      const result: number[] = [];
      for (let i = 0; i < blob.length; i += 2) {
        const value: number = blob.readUInt16LE(i);
        result.push(value);
      }
      return result;
    }
    case 'f32': {
      if (blob.length % 4 !== 0) {
        throw new Error(
          `Invalid f32 blob length ${blob.length} for sample type ${type}`,
        );
      }
      const result: number[] = [];
      for (let i = 0; i < blob.length; i += 4) {
        const value: number = blob.readFloatLE(i);
        result.push(value);
      }
      return result;
    }
    default: {
      const _exhaustive: never = enc;
      throw new Error(`Unsupported sample encoding: ${String(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Внутренние хелперы clamp
// ---------------------------------------------------------------------------

/**
 * Приводит число к диапазону Uint8 (0..255) с округлением.
 *
 * NaN/±Infinity трактуются как 0 — см. комментарий к packSamples.
 */
function clampU8(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v <= 0) return 0;
  if (v >= 255) return 255;
  return Math.round(v);
}

/**
 * Приводит число к диапазону Uint16 (0..65535) с округлением.
 *
 * NaN/±Infinity трактуются как 0 — см. комментарий к packSamples.
 */
function clampU16(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v <= 0) return 0;
  if (v >= 65535) return 65535;
  return Math.round(v);
}
