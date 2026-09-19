// polar-api/schemas/polar-v4.schemas.ts
import { z } from 'zod';

// ─── Базовые хелперы ────────────────────────────────────────
/**
 * Polar присылает даты в двух видах:
 *   - "2025-01-01T10:12:33.435"       (без таймзоны)
 *   - "2025-01-01T10:12:33.435Z"      (UTC)
 *   - "2025-01-01T10:12:33.435+03:00" (с офсетом)
 *
 * Параметры:
 *   - offset: true — разрешает "Z" и "+HH:MM"
 *   - local: true  — разрешает даты без таймзоны вообще
 */
const DateTimeString = z.string().datetime({ offset: true, local: true });

// ─── Числовые хелперы ───────────────────────────────────────
/**
 * Polar AccessLink в JSON-ответах часто присылает числа строками:
 *   "height": "180.0", "weight": "70.0", "recoveryTimeMillis": "1234"
 *
 * Поэтому все числовые поля проходят через z.coerce.number():
 * он принимает и number, и numeric string, и приводит к number.
 * Это безопасно: для настоящих чисел поведение не меняется.
 */
const NonNegativeNumber = z.coerce.number();
const NonNegativeInt = z.coerce.number().int();

// ─── Идентификаторы и справочники ───────────────────────────
export const IdentifierSchema = z.object({
  id: z.string(),
});

export const SportRefSchema = z.object({
  id: z.string(),
});

export const ProductSchema = z.object({
  modelName: z.string().optional(),
});

export const ApplicationSchema = z.object({
  name: z.string().optional(),
});

// ─── Physical information ───────────────────────────────────
export const PhysicalInformationSchema = z.object({
  modified: DateTimeString,
  created: DateTimeString,
  birthday: z.string().optional(),
  sex: z.string().optional(),
  weightKg: z.coerce.number().optional(),
  heightCm: z.coerce.number().int().optional(),
  maximumHeartRate: z.coerce.number().int().optional(),
  restingHeartRate: z.coerce.number().int().optional(),
  aerobicThreshold: z.coerce.number().int().optional(),
  anaerobicThreshold: z.coerce.number().int().optional(),
  vo2Max: z.coerce.number().optional(),
  trainingBackground: z.string().optional(),
  typicalDay: z.string().optional(),
  metThreshold: z.coerce.number().optional(),
  weeklyRtSum: z.coerce.number().optional(),
  functionalThresholdPower: z.coerce.number().optional(),
  speedCalibrationOffset: z.coerce.number().optional(),
  weightSource: z.string().optional(),
  sleepGoalMinutes: z.coerce.number().int().optional(),
  maximumAerobicPower: z.coerce.number().optional(),
  maximumAerobicSpeedKmh: z.coerce.number().optional(),
  maximumAerobicSpeedSource: z.string().optional(),
});

// ─── Samples (v4) ───────────────────────────────────────────
export const SampleTypeEnum = z.enum([
  'HEART_RATE',
  'SPEED',
  'CADENCE',
  'POWER',
  'ALTITUDE',
  'DISTANCE',
  'TEMPERATURE',
  'RR',
]);

export const SampleSchema = z.object({
  type: SampleTypeEnum,
  intervalMillis: z.coerce.number().int().positive(),
  values: z.array(z.coerce.number()),
});

export const RrSampleSchema = z.object({
  durationMillis: z.coerce.number().int().optional(),
  offline: z.boolean().optional(),
  values: z.array(z.coerce.number()).optional(),
});

export const SwimmingPhasesSchema = z.object({
  startTime: DateTimeString,
  phases: z.array(
    z.object({
      startOffsetMillis: z.coerce.number().int(),
      durationMillis: z.coerce.number().int(),
      style: z.string(),
      strokes: z.coerce.number().int(),
    }),
  ),
});

export const SamplesWrapperSchema = z.object({
  samples: z.array(SampleSchema).optional(),
  transitionSamples: z.array(SampleSchema).optional(),
  rrSamples: z.array(RrSampleSchema).optional(),
  transitionRrSamples: z.array(RrSampleSchema).optional(),
  swimmingPhases: SwimmingPhasesSchema.optional(),
});

// ─── Routes ─────────────────────────────────────────────────
export const WayPointSchema = z.object({
  longitude: z.coerce.number(),
  latitude: z.coerce.number(),
  altitude: z.coerce.number().optional(),
  elapsedMillis: z.coerce.number().int(),
});

export const RouteSchema = z.object({
  startTime: DateTimeString,
  wayPoints: z.array(WayPointSchema),
});

export const RoutesWrapperSchema = z.object({
  route: RouteSchema.optional(),
  transitionRoute: RouteSchema.optional(),
});

// ─── Zones ──────────────────────────────────────────────────
export const ZoneSchema = z.object({
  lowerLimit: z.coerce.number(),
  higherLimit: z.coerce.number(),
  inZone: z.coerce.number(),
  distanceMeters: z.coerce.number().optional(),
  muscleLoad: z.coerce.number().optional(),
});

export const ZonesGroupSchema = z.object({
  type: z.string(),
  zones: z.array(ZoneSchema),
});

// ─── Statistics ─────────────────────────────────────────────
export const StatisticEntrySchema = z.object({
  type: z.string(),
  min: z.coerce.number(),
  avg: z.coerce.number(),
  max: z.coerce.number(),
});

export const SwimmingStatisticsSchema = z.object({
  distanceMeters: z.coerce.number().optional(),
  totalStrokeCount: z.coerce.number().int().optional(),
  poolsSwum: z.coerce.number().int().optional(),
  poolUnits: z.string().optional(),
  poolLength: z.coerce.number().optional(),
  avgSecsPerPool: z.coerce.number().optional(),
  strokes: z.coerce.number().int().optional(),
  swimmingStyles: z
    .array(
      z.object({
        style: z.string(),
        distanceMeters: z.coerce.number().optional(),
        strokeCount: z.coerce.number().int().optional(),
        swimmingTimeTotalMillis: z.coerce.number().int().optional(),
        poolTimeMinMillis: z.coerce.number().int().optional(),
        hrAvg: z.coerce.number().int().optional(),
        hrMax: z.coerce.number().int().optional(),
        swolfAvg: z.coerce.number().optional(),
      }),
    )
    .optional(),
});

export const TrainingPeaksStatisticsSchema = z.object({
  intensityFactor: z.coerce.number().optional(),
  normalizedPower: z.coerce.number().optional(),
  trainingStressScore: z.coerce.number().optional(),
});

export const StatisticsSchema = z.object({
  statistics: z.array(StatisticEntrySchema).optional(),
  swimmingStatistics: SwimmingStatisticsSchema.optional(),
  trainingPeaksStatistics: TrainingPeaksStatisticsSchema.optional(),
});

// ─── Laps ───────────────────────────────────────────────────
export const LapSchema = z.object({
  splitTimeMillis: z.coerce.number().int(),
  durationMillis: z.coerce.number().int(),
  distanceMeters: z.coerce.number().optional(),
  startLocationLatitude: z.coerce.number().optional(),
  startLocationLongitude: z.coerce.number().optional(),
  startLocationAltitude: z.coerce.number().optional(),
  startLocationTimeMillis: z.coerce.number().int().optional(),
  ascentMeters: z.coerce.number().optional(),
  descentMeters: z.coerce.number().optional(),
  statistics: StatisticsSchema.optional(),
});

export const LapsWrapperSchema = z.object({
  laps: z.array(LapSchema).optional(),
  autoLaps: z.array(LapSchema).optional(),
});

// ─── Strength training results ──────────────────────────────
export const CompletedSetSchema = z.object({
  type: z.string(),
  startTimeDeltaMillis: z.coerce.number().int(),
  endTimeDeltaMillis: z.coerce.number().int(),
  resistanceType: z.string().optional(),
  movement: z.string().optional(),
  avgHeartRate: z.coerce.number().int().optional(),
  maxHeartRate: z.coerce.number().int().optional(),
});

export const CompletedRoundSchema = z.object({
  type: z.string(),
  startTimeDeltaMillis: z.coerce.number().int(),
  endTimeDeltaMillis: z.coerce.number().int(),
  workoutPhase: z.string().optional(),
  completedSets: z.array(CompletedSetSchema).optional(),
});

export const StrengthTrainingResultsSchema = z.object({
  completedRounds: z.array(CompletedRoundSchema).optional(),
});

// ─── Training load report ───────────────────────────────────
export const TrainingLoadReportSchema = z.object({
  cardioLoad: z.coerce.number().optional(),
  muscleLoad: z.coerce.number().optional(),
  cardioLoadInterpretation: z.string().optional(),
  muscleLoadInterpretation: z.string().optional(),
  calculationTime: DateTimeString.optional(),
  sessionRpe: z.string().optional(),
  perceivedLoad: z.coerce.number().optional(),
  perceivedLoadInterpretation: z.string().optional(),
});

// ─── Pause times ────────────────────────────────────────────
export const PauseTimeSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
});

// ─── Calibration offsets ────────────────────────────────────
export const CalibrationOffsetSchema = z.object({
  sampleSourceType: z.string(),
  value: z.coerce.number(),
});

// ─── Exercise внутри сессии (v4) ────────────────────────────
export const ExerciseSchema = z.object({
  identifier: IdentifierSchema,
  created: DateTimeString,
  modified: DateTimeString,
  startTime: DateTimeString,
  stopTime: DateTimeString,
  durationMillis: NonNegativeInt,
  distanceMeters: NonNegativeNumber.optional(),
  calories: NonNegativeNumber.optional(),
  fatPercentage: z.coerce.number().optional(),
  recoveryTimeMillis: NonNegativeInt.optional(),
  trainingLoad: z.coerce.number().optional(),
  carboPercentage: z.coerce.number().optional(),
  proteinPercentage: z.coerce.number().optional(),
  runningIndex: z.coerce.number().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  ascentMeters: z.coerce.number().optional(),
  descentMeters: z.coerce.number().optional(),
  sprintCounter: z.coerce.number().int().optional(),
  walkingDurationMillis: NonNegativeInt.optional(),
  walkingDistanceMeters: NonNegativeNumber.optional(),
  speedCalibrationOffset: z.coerce.number().optional(),
  timezoneOffsetMinutes: z.coerce.number().int().optional(),
  calibrationOffsets: z.array(CalibrationOffsetSchema).optional(),
  sport: SportRefSchema.optional(),
  strengthTrainingResults: StrengthTrainingResultsSchema.optional(),
  trainingLoadReport: TrainingLoadReportSchema.optional(),
  laps: LapsWrapperSchema.optional(),
  statistics: StatisticsSchema.optional(),
  zones: z.array(ZonesGroupSchema).optional(),
  samples: SamplesWrapperSchema.optional(),
  routes: RoutesWrapperSchema.optional(),
  pauseTimes: z.array(PauseTimeSchema).optional(),
});

// ─── Test results ───────────────────────────────────────────
export const TestPhaseSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  durationMillis: NonNegativeInt,
  avgHrBpm: z.coerce.number().int().optional(),
  maxHrBpm: z.coerce.number().int().optional(),
  avgSpeedKmh: z.coerce.number().optional(),
  maxSpeedKmh: z.coerce.number().optional(),
  avgCadence: z.coerce.number().optional(),
  maxCadence: z.coerce.number().optional(),
  avgPower: z.coerce.number().optional(),
  maxPower: z.coerce.number().optional(),
});

export const CyclingTestSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  warmup: TestPhaseSchema.optional(),
  performance: TestPhaseSchema.optional(),
  cooldown: TestPhaseSchema.optional(),
  fitnessClass: z.string().optional(),
  functionalThresholdPower: z.coerce.number().optional(),
  previousFunctionalThresholdPower: z.coerce.number().optional(),
  vo2max: z.coerce.number().optional(),
});

export const RunningTestSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  warmup: TestPhaseSchema.optional(),
  performance: TestPhaseSchema.optional(),
  cooldown: TestPhaseSchema.optional(),
  category: z.string().optional(),
  maxAerobicSpeedKmh: z.coerce.number().optional(),
  maxAerobicPower: z.coerce.number().optional(),
  maxHrBpm: z.coerce.number().int().optional(),
  vo2max: z.coerce.number().optional(),
  initialSpeedKmh: z.coerce.number().optional(),
  speedIncreaseRate: z.coerce.number().optional(),
  qualityRatePercent: z.coerce.number().optional(),
});

export const WalkingTestSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  warmup: TestPhaseSchema.optional(),
  performance: TestPhaseSchema.optional(),
  cooldown: TestPhaseSchema.optional(),
  category: z.string().optional(),
  fitnessClass: z.string().optional(),
  avgSpeedKmh: z.coerce.number().optional(),
  maxSpeedKmh: z.coerce.number().optional(),
  testDistanceMeters: z.coerce.number().optional(),
  steps: z.coerce.number().int().optional(),
  avgCadence: z.coerce.number().optional(),
  maxCadence: z.coerce.number().optional(),
  testHrBpm: z.coerce.number().int().optional(),
  maxHrBpm: z.coerce.number().int().optional(),
  vo2max: z.coerce.number().optional(),
  walkingPercent: z.coerce.number().optional(),
  speedVariationPercent: z.coerce.number().optional(),
  cadenceVariationPercent: z.coerce.number().optional(),
  hrAbove65ProsMaxHr: z.coerce.number().optional(),
  allCriterionQualityPercent: z.coerce.number().optional(),
  steadyWalkingGuidance: z.coerce.number().optional(),
  walkingSpeedGuidance: z.coerce.number().optional(),
  duration: z.coerce.number().int().optional(),
});

export const TestResultsSchema = z.object({
  cyclingTest: CyclingTestSchema.optional(),
  runningTest: RunningTestSchema.optional(),
  walkingTest: WalkingTestSchema.optional(),
});

// ─── Hill splits ────────────────────────────────────────────
export const HillSchema = z.object({
  type: z.string(),
  startTime: DateTimeString,
  endTime: DateTimeString,
  upHill: z
    .object({
      uphillNumber: z.coerce.number().int(),
      ascentMeters: z.coerce.number(),
      avgInclinePercent: z.coerce.number(),
    })
    .optional(),
  downHill: z
    .object({
      downhillNumber: z.coerce.number().int(),
      descentMeters: z.coerce.number(),
      avgDeclinePercent: z.coerce.number(),
    })
    .optional(),
  distanceMeters: z.coerce.number().optional(),
  maxSpeedKmh: z.coerce.number().optional(),
  avgSpeedKmh: z.coerce.number().optional(),
  startAltitudeMeters: z.coerce.number().optional(),
  endAltitudeMeters: z.coerce.number().optional(),
  avgHrBpm: z.coerce.number().int().optional(),
  maxHrBpm: z.coerce.number().int().optional(),
  duration: z.coerce.number().int().optional(),
  avgCadence: z.coerce.number().optional(),
  maxCadence: z.coerce.number().optional(),
  avgPower: z.coerce.number().optional(),
  maxPower: z.coerce.number().optional(),
});

export const HillSplitsSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  totalUphillDistanceMeters: z.coerce.number().optional(),
  totalDownhillDistanceMeters: z.coerce.number().optional(),
  totalUphillCount: z.coerce.number().int().optional(),
  totalDownhillCount: z.coerce.number().int().optional(),
  hills: z.array(HillSchema).optional(),
});

// ─── Comments ───────────────────────────────────────────────
export const CommentSchema = z.object({
  identifier: IdentifierSchema.optional(),
  created: DateTimeString.optional(),
  modified: DateTimeString.optional(),
  note: z.string().optional(),
  fromOtherUser: z.boolean().optional(),
});

// ─── Training Session (v4) ──────────────────────────────────
export const TrainingSessionSchema = z.object({
  identifier: IdentifierSchema,
  created: DateTimeString,
  modified: DateTimeString,
  startTime: DateTimeString,
  stopTime: DateTimeString,
  durationMillis: NonNegativeInt,
  name: z.string().optional(),
  feeling: z.coerce.number().optional(),
  deviceId: z.string().optional(),
  note: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  distanceMeters: NonNegativeNumber.optional(),
  calories: NonNegativeNumber.optional(),
  trainingLoad: z.coerce.number().optional(),
  trainingBenefit: z.string().optional(),
  carboPercentage: z.coerce.number().optional(),
  fatPercentage: z.coerce.number().optional(),
  proteinPercentage: z.coerce.number().optional(),
  recoveryTimeMillis: NonNegativeInt.optional(),
  hrMax: z.coerce.number().int().optional(),
  hrAvg: z.coerce.number().int().optional(),
  timezoneOffsetMinutes: z.coerce.number().int().optional(),
  startTrigger: z.string().optional(),
  physicalInformation: PhysicalInformationSchema.optional(),
  application: ApplicationSchema.optional(),
  sport: SportRefSchema.optional(),
  product: ProductSchema.optional(),
  trainingTarget: IdentifierSchema.optional(),
  favoriteTarget: IdentifierSchema.optional(),
  exercises: z.array(ExerciseSchema).optional(),
  externalIdentifier: z.string().optional(),
  testResults: TestResultsSchema.optional(),
  hillSplits: HillSplitsSchema.optional(),
  trainingLoadReport: TrainingLoadReportSchema.optional(),
  comments: z.array(CommentSchema).optional(),
});

// ─── Корневой ответ v4 ──────────────────────────────────────
export const TrainingSessionsResponseSchema = z.object({
  trainingSessions: z.array(TrainingSessionSchema),
});

// ─── Features (query-параметр v4) ───────────────────────────
export const TRAINING_SESSION_FEATURES = [
  'samples',
  'test-results',
  'training-load-report',
  'laps',
  'hill-splits',
  'routes',
  'statistics',
  'zones',
  'pause-times',
  'strength-training-results',
  'comments',
  'physical-info',
] as const;

// ═══════════════════════════════════════════════════════════
//  v3 API
// ═══════════════════════════════════════════════════════════
//
// v3 использует snake_case в ответах. Реальные ответы проверены
// на живом Polar (см. логи getExercise RAW keys).
//
// Ниже — схемы для:
//   GET /v3/exercises            — список тренировок за 30 дней
//   GET /v3/exercises/{id}       — одна тренировка с samples
//   POST /v3/users               — регистрация пользователя

// ─── Элемент списка тренировок (v3) ─────────────────────────
/**
 * Поля — snake_case, как их возвращает Polar v3.
 *
 * .passthrough() нужен, потому что Polar v3 может вернуть
 * больше полей, чем мы описали. Лишние не ломают валидацию
 * и остаются доступными в объекте как есть.
 */
export const ExerciseV3Schema = z
  .object({
    id: z.string(),
    upload_time: z.string().optional(),
    polar_user: z.string().optional(),
    device: z.string().optional(),
    device_id: z.string().optional(),
    start_time: z.string(),
    start_time_utc_offset: z.coerce.number().int().optional(),
    duration: z.string().optional(),
    calories: z.coerce.number().int().optional(),
    distance: z.coerce.number().optional(),
    heart_rate: z
      .object({
        average: z.coerce.number().int().optional(),
        maximum: z.coerce.number().int().optional(),
      })
      .optional(),
    training_load: z.coerce.number().optional(),
    sport: z.string().optional(),
    has_route: z.boolean().optional(),
    club_id: z.coerce.number().int().optional(),
  })
  .passthrough();

/**
 * Ответ GET /v3/exercises.
 *
 * ВАЖНО: v3 возвращает МАССИВ тренировок напрямую, без обёртки
 * в объект. Именно поэтому схема — не z.object, а z.array.
 */
export const ExercisesResponseSchema = z.array(ExerciseV3Schema);

// ─── Одна тренировка (v3) ───────────────────────────────────
/**
 * GET /v3/exercises/{exerciseId}
 *
 * Реальные поля (проверено на живом ответе Polar):
 *   - `samples[]` использует snake_case: `recording_rate`,
 *     `sample_type`, `data`. НЕ kebab-case, как в документации.
 *   - `sample_type` — число (0, 1, 2, ...), не строка.
 *   - `training_load_pro` не всегда содержит `date`.
 *
 * Числовые поля обёрнуты в z.coerce.number(): Polar v3 иногда
 * присылает их строками, иногда числами.
 *
 * `.passthrough()` на верхнем уровне — Polar может добавить
 * новые поля без предупреждения.
 */

export const PolarHeartRateSchema = z
  .object({
    average: z.coerce.number().int().optional(),
    maximum: z.coerce.number().int().optional(),
  })
  .passthrough();

/**
 * Элемент `heart_rate_zones`. Ключи в kebab-case — так их
 * возвращает Polar (проверено на живом ответе).
 */
export const PolarHeartRateZoneSchema = z.object({
  index: z.coerce.number().int(),
  'lower-limit': z.coerce.number().int(),
  'upper-limit': z.coerce.number().int(),
  'in-zone': z.string(),
});

/**
 * Элемент `samples` — один канал сэмплов.
 *
 * ВАЖНО: реальный формат — snake_case, а не kebab-case:
 *   { "recording_rate": 1, "sample_type": 0, "data": "0,0,0,..." }
 *
 * `sample_type` — ЧИСЛО, а не строка:
 *   0 — not defined / неизвестный канал
 *   1 — Heart rate
 *   2 — Speed
 *   3 — Cadence
 *   4 — Altitude
 *   5 — Power
 *   6 — Distance
 *   7 — Temperature
 *
 * `recording_rate` — интервал записи в секундах.
 * `data` — значения через запятую, одной строкой.
 *
 * `data` НЕ парсим здесь в массив: маппинг делает PolarAdapter.
 */
export const PolarSampleSchema = z.object({
  recording_rate: z.coerce.number().int().positive(),
  sample_type: z.coerce.number().int(),
  data: z.string(),
});

/**
 * Элемент `route` — одна GPS-точка.
 */
export const PolarRoutePointSchema = z.object({
  latitude: z.coerce.number(),
  longitude: z.coerce.number(),
  time: z.string(), // ISO 8601 duration от старта, "PT210.026S"
  satellites: z.coerce.number().int().optional(),
  fix: z.coerce.number().int().optional(),
});

/**
 * Блок `training_load_pro` — расширенный training load.
 *
 * Все поля опциональны. В реальных ответах Polar `date` иногда
 * отсутствует, а значения могут быть -1 (NOT_AVAILABLE).
 * Ключи — kebab-case.
 */
export const PolarTrainingLoadProSchema = z.object({
  date: z.string().optional(),
  'cardio-load': z.coerce.number().optional(),
  'muscle-load': z.coerce.number().optional(),
  'perceived-load': z.coerce.number().optional(),
  'cardio-load-interpretation': z.string().optional(),
  'muscle-load-interpretation': z.string().optional(),
  'perceived-load-interpretation': z.string().optional(),
  'user-rpe': z.string().optional(),
});

/**
 * Корневая схема одиночного ответа `GET /v3/exercises/{id}`.
 */
export const PolarExerciseSchema = z
  .object({
    // ── Идентификация ──
    id: z.string(),
    upload_time: z.string().optional(),
    polar_user: z.string().optional(),

    // ── Устройство ──
    device: z.string().optional(),
    device_id: z.string().optional(),

    // ── Время ──
    start_time: z.string(),
    start_time_utc_offset: z.coerce.number().int().optional(),
    duration: z.string(), // ISO 8601 duration, "PT2H44M"

    // ── Основные метрики ──
    calories: z.coerce.number().int().optional(),
    distance: z.coerce.number().optional(),
    heart_rate: PolarHeartRateSchema.optional(),
    training_load: z.coerce.number().optional(),

    // ── Спорт ──
    sport: z.string().optional(),
    detailed_sport_info: z.string().optional(),

    // ── Маршрут ──
    has_route: z.boolean().optional(),

    // ── Клуб ──
    club_id: z.coerce.number().int().optional(),
    club_name: z.string().optional(),

    // ── Проценты расхода ──
    fat_percentage: z.coerce.number().optional(),
    carbohydrate_percentage: z.coerce.number().optional(),
    protein_percentage: z.coerce.number().optional(),

    // ── Running index ──
    // В JSON ключ с дефисом, в TS-объекте — через кавычки.
    'running-index': z.coerce.number().optional(),

    // ── Зоны и сэмплы ──
    heart_rate_zones: z.array(PolarHeartRateZoneSchema).optional(),
    samples: z.array(PolarSampleSchema).optional(),
    route: z.array(PolarRoutePointSchema).optional(),

    // ── Расширенный training load ──
    training_load_pro: PolarTrainingLoadProSchema.optional(),
  })
  .passthrough();

// ─── User Registration (v3) ─────────────────────────────────
/**
 * POST /v3/users
 * Polar ожидает member-id — ваш внутренний идентификатор пользователя.
 */
export const RegisterUserRequestSchema = z.object({
  'member-id': z.string(),
});

/**
 * Ответ при успешной регистрации (201 Created) или
 * при повторной регистрации (200 OK).
 * Polar возвращает внутренний user-id, совпадающий с x_user_id из OAuth.
 */
export const RegisterUserResponseSchema = z.object({
  'polar-user-id': z
    .union([z.coerce.number().int().positive(), z.string().regex(/^\d+$/)])
    .transform(String),
  'member-id': z.string().optional(),
});

// ─── Типы v4 ────────────────────────────────────────────────
export type TrainingSession = z.infer<typeof TrainingSessionSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Sample = z.infer<typeof SampleSchema>;
export type TrainingSessionsResponse = z.infer<
  typeof TrainingSessionsResponseSchema
>;
export type TrainingSessionFeature = (typeof TRAINING_SESSION_FEATURES)[number];

// ─── Типы v3: список ────────────────────────────────────────
export type ExerciseV3 = z.infer<typeof ExerciseV3Schema>;
export type ExercisesResponse = z.infer<typeof ExercisesResponseSchema>;

// ─── Типы v3: одна тренировка ───────────────────────────────
export type PolarExerciseV3 = z.infer<typeof PolarExerciseSchema>;
export type PolarSampleV3 = z.infer<typeof PolarSampleSchema>;
export type PolarRoutePointV3 = z.infer<typeof PolarRoutePointSchema>;
export type PolarHeartRateZoneV3 = z.infer<typeof PolarHeartRateZoneSchema>;
export type PolarTrainingLoadProV3 = z.infer<typeof PolarTrainingLoadProSchema>;

// ─── Типы v3: регистрация ───────────────────────────────────
export type RegisterUserRequest = z.infer<typeof RegisterUserRequestSchema>;
export type RegisterUserResponse = z.infer<typeof RegisterUserResponseSchema>;
