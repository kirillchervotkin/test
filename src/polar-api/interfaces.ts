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
 *
 * Вместо .refine() используем встроенную валидацию — она возвращает
 * ZodString, а не ZodEffects, и TypeScript корректно выводит тип.
 */
const DateTimeString = z.string().datetime({ offset: true, local: true });

// ─── Числовые хелперы ───────────────────────────────────────
/**
 * В примерах Polar встречаются "странные" значения (walkingDurationMillis
 * при walkingDistanceMeters > 0), но всё это валидные числа.
 */
const NonNegativeNumber = z.number();
const NonNegativeInt = z.number().int();

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
  weightKg: z.number().optional(),
  heightCm: z.number().int().optional(),
  maximumHeartRate: z.number().int().optional(),
  restingHeartRate: z.number().int().optional(),
  aerobicThreshold: z.number().int().optional(),
  anaerobicThreshold: z.number().int().optional(),
  vo2Max: z.number().optional(),
  trainingBackground: z.string().optional(),
  typicalDay: z.string().optional(),
  metThreshold: z.number().optional(),
  weeklyRtSum: z.number().optional(),
  functionalThresholdPower: z.number().optional(),
  speedCalibrationOffset: z.number().optional(),
  weightSource: z.string().optional(),
  sleepGoalMinutes: z.number().int().optional(),
  maximumAerobicPower: z.number().optional(),
  maximumAerobicSpeedKmh: z.number().optional(),
  maximumAerobicSpeedSource: z.string().optional(),
});

// ─── Samples ────────────────────────────────────────────────
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
  intervalMillis: z.number().int().positive(),
  values: z.array(z.number()),
});

export const RrSampleSchema = z.object({
  durationMillis: z.number().int().optional(),
  offline: z.boolean().optional(),
  values: z.array(z.number()).optional(),
});

export const SwimmingPhasesSchema = z.object({
  startTime: DateTimeString,
  phases: z.array(
    z.object({
      startOffsetMillis: z.number().int(),
      durationMillis: z.number().int(),
      style: z.string(),
      strokes: z.number().int(),
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
  longitude: z.number(),
  latitude: z.number(),
  altitude: z.number().optional(),
  elapsedMillis: z.number().int(),
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
  lowerLimit: z.number(),
  higherLimit: z.number(),
  inZone: z.number(),
  distanceMeters: z.number().optional(),
  muscleLoad: z.number().optional(),
});

export const ZonesGroupSchema = z.object({
  type: z.string(),
  zones: z.array(ZoneSchema),
});

// ─── Statistics ─────────────────────────────────────────────
export const StatisticEntrySchema = z.object({
  type: z.string(),
  min: z.number(),
  avg: z.number(),
  max: z.number(),
});

export const SwimmingStatisticsSchema = z.object({
  distanceMeters: z.number().optional(),
  totalStrokeCount: z.number().int().optional(),
  poolsSwum: z.number().int().optional(),
  poolUnits: z.string().optional(),
  poolLength: z.number().optional(),
  avgSecsPerPool: z.number().optional(),
  strokes: z.number().int().optional(),
  swimmingStyles: z
    .array(
      z.object({
        style: z.string(),
        distanceMeters: z.number().optional(),
        strokeCount: z.number().int().optional(),
        swimmingTimeTotalMillis: z.number().int().optional(),
        poolTimeMinMillis: z.number().int().optional(),
        hrAvg: z.number().int().optional(),
        hrMax: z.number().int().optional(),
        swolfAvg: z.number().optional(),
      }),
    )
    .optional(),
});

export const TrainingPeaksStatisticsSchema = z.object({
  intensityFactor: z.number().optional(),
  normalizedPower: z.number().optional(),
  trainingStressScore: z.number().optional(),
});

export const StatisticsSchema = z.object({
  statistics: z.array(StatisticEntrySchema).optional(),
  swimmingStatistics: SwimmingStatisticsSchema.optional(),
  trainingPeaksStatistics: TrainingPeaksStatisticsSchema.optional(),
});

// ─── Laps ───────────────────────────────────────────────────
export const LapSchema = z.object({
  splitTimeMillis: z.number().int(),
  durationMillis: z.number().int(),
  distanceMeters: z.number().optional(),
  startLocationLatitude: z.number().optional(),
  startLocationLongitude: z.number().optional(),
  startLocationAltitude: z.number().optional(),
  startLocationTimeMillis: z.number().int().optional(),
  ascentMeters: z.number().optional(),
  descentMeters: z.number().optional(),
  statistics: StatisticsSchema.optional(),
});

export const LapsWrapperSchema = z.object({
  laps: z.array(LapSchema).optional(),
  autoLaps: z.array(LapSchema).optional(),
});

// ─── Strength training results ──────────────────────────────
export const CompletedSetSchema = z.object({
  type: z.string(),
  startTimeDeltaMillis: z.number().int(),
  endTimeDeltaMillis: z.number().int(),
  resistanceType: z.string().optional(),
  movement: z.string().optional(),
  avgHeartRate: z.number().int().optional(),
  maxHeartRate: z.number().int().optional(),
});

export const CompletedRoundSchema = z.object({
  type: z.string(),
  startTimeDeltaMillis: z.number().int(),
  endTimeDeltaMillis: z.number().int(),
  workoutPhase: z.string().optional(),
  completedSets: z.array(CompletedSetSchema).optional(),
});

export const StrengthTrainingResultsSchema = z.object({
  completedRounds: z.array(CompletedRoundSchema).optional(),
});

// ─── Training load report ───────────────────────────────────
export const TrainingLoadReportSchema = z.object({
  cardioLoad: z.number().optional(),
  muscleLoad: z.number().optional(),
  cardioLoadInterpretation: z.string().optional(),
  muscleLoadInterpretation: z.string().optional(),
  calculationTime: DateTimeString.optional(),
  sessionRpe: z.string().optional(),
  perceivedLoad: z.number().optional(),
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
  value: z.number(),
});

// ─── Exercise внутри сессии ─────────────────────────────────
export const ExerciseSchema = z.object({
  identifier: IdentifierSchema,
  created: DateTimeString,
  modified: DateTimeString,
  startTime: DateTimeString,
  stopTime: DateTimeString,
  durationMillis: NonNegativeInt,
  distanceMeters: NonNegativeNumber.optional(),
  calories: NonNegativeNumber.optional(),
  fatPercentage: z.number().optional(),
  recoveryTimeMillis: NonNegativeInt.optional(),
  trainingLoad: z.number().optional(),
  carboPercentage: z.number().optional(),
  proteinPercentage: z.number().optional(),
  runningIndex: z.number().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  ascentMeters: z.number().optional(),
  descentMeters: z.number().optional(),
  sprintCounter: z.number().int().optional(),
  walkingDurationMillis: NonNegativeInt.optional(),
  walkingDistanceMeters: NonNegativeNumber.optional(),
  speedCalibrationOffset: z.number().optional(),
  timezoneOffsetMinutes: z.number().int().optional(),
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
  avgHrBpm: z.number().int().optional(),
  maxHrBpm: z.number().int().optional(),
  avgSpeedKmh: z.number().optional(),
  maxSpeedKmh: z.number().optional(),
  avgCadence: z.number().optional(),
  maxCadence: z.number().optional(),
  avgPower: z.number().optional(),
  maxPower: z.number().optional(),
});

export const CyclingTestSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  warmup: TestPhaseSchema.optional(),
  performance: TestPhaseSchema.optional(),
  cooldown: TestPhaseSchema.optional(),
  fitnessClass: z.string().optional(),
  functionalThresholdPower: z.number().optional(),
  previousFunctionalThresholdPower: z.number().optional(),
  vo2max: z.number().optional(),
});

export const RunningTestSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  warmup: TestPhaseSchema.optional(),
  performance: TestPhaseSchema.optional(),
  cooldown: TestPhaseSchema.optional(),
  category: z.string().optional(),
  maxAerobicSpeedKmh: z.number().optional(),
  maxAerobicPower: z.number().optional(),
  maxHrBpm: z.number().int().optional(),
  vo2max: z.number().optional(),
  initialSpeedKmh: z.number().optional(),
  speedIncreaseRate: z.number().optional(),
  qualityRatePercent: z.number().optional(),
});

export const WalkingTestSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  warmup: TestPhaseSchema.optional(),
  performance: TestPhaseSchema.optional(),
  cooldown: TestPhaseSchema.optional(),
  category: z.string().optional(),
  fitnessClass: z.string().optional(),
  avgSpeedKmh: z.number().optional(),
  maxSpeedKmh: z.number().optional(),
  testDistanceMeters: z.number().optional(),
  steps: z.number().int().optional(),
  avgCadence: z.number().optional(),
  maxCadence: z.number().optional(),
  testHrBpm: z.number().int().optional(),
  maxHrBpm: z.number().int().optional(),
  vo2max: z.number().optional(),
  walkingPercent: z.number().optional(),
  speedVariationPercent: z.number().optional(),
  cadenceVariationPercent: z.number().optional(),
  hrAbove65ProsMaxHr: z.number().optional(),
  allCriterionQualityPercent: z.number().optional(),
  steadyWalkingGuidance: z.number().optional(),
  walkingSpeedGuidance: z.number().optional(),
  duration: z.number().int().optional(),
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
      uphillNumber: z.number().int(),
      ascentMeters: z.number(),
      avgInclinePercent: z.number(),
    })
    .optional(),
  downHill: z
    .object({
      downhillNumber: z.number().int(),
      descentMeters: z.number(),
      avgDeclinePercent: z.number(),
    })
    .optional(),
  distanceMeters: z.number().optional(),
  maxSpeedKmh: z.number().optional(),
  avgSpeedKmh: z.number().optional(),
  startAltitudeMeters: z.number().optional(),
  endAltitudeMeters: z.number().optional(),
  avgHrBpm: z.number().int().optional(),
  maxHrBpm: z.number().int().optional(),
  duration: z.number().int().optional(),
  avgCadence: z.number().optional(),
  maxCadence: z.number().optional(),
  avgPower: z.number().optional(),
  maxPower: z.number().optional(),
});

export const HillSplitsSchema = z.object({
  startTime: DateTimeString,
  endTime: DateTimeString,
  totalUphillDistanceMeters: z.number().optional(),
  totalDownhillDistanceMeters: z.number().optional(),
  totalUphillCount: z.number().int().optional(),
  totalDownhillCount: z.number().int().optional(),
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

// ─── Training Session ───────────────────────────────────────
export const TrainingSessionSchema = z.object({
  identifier: IdentifierSchema,
  created: DateTimeString,
  modified: DateTimeString,
  startTime: DateTimeString,
  stopTime: DateTimeString,
  durationMillis: NonNegativeInt,
  name: z.string().optional(),
  feeling: z.number().optional(),
  deviceId: z.string().optional(),
  note: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  distanceMeters: NonNegativeNumber.optional(),
  calories: NonNegativeNumber.optional(),
  trainingLoad: z.number().optional(),
  trainingBenefit: z.string().optional(),
  carboPercentage: z.number().optional(),
  fatPercentage: z.number().optional(),
  proteinPercentage: z.number().optional(),
  recoveryTimeMillis: NonNegativeInt.optional(),
  hrMax: z.number().int().optional(),
  hrAvg: z.number().int().optional(),
  timezoneOffsetMinutes: z.number().int().optional(),
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

// ─── Корневой ответ ─────────────────────────────────────────
export const TrainingSessionsResponseSchema = z.object({
  trainingSessions: z.array(TrainingSessionSchema),
});

// ─── Features (query-параметр) ──────────────────────────────
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

// ─── User Registration ──────────────────────────────────────
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
  'user-id': z.string(),
});

// ─── Типы ───────────────────────────────────────────────────
export type TrainingSession = z.infer<typeof TrainingSessionSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type Sample = z.infer<typeof SampleSchema>;
export type TrainingSessionsResponse = z.infer<
  typeof TrainingSessionsResponseSchema
>;
export type TrainingSessionFeature = (typeof TRAINING_SESSION_FEATURES)[number];

export type RegisterUserRequest = z.infer<typeof RegisterUserRequestSchema>;
export type RegisterUserResponse = z.infer<typeof RegisterUserResponseSchema>;
