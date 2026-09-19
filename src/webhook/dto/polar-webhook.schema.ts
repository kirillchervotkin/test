// webhook/dto/polar-webhook.schema.ts
import { z } from 'zod';

/**
 * Zod-схемы для Polar-вебхуков.
 *
 * Используем zod, а не class-validator, потому что:
 *   - payload приходит из SQS/MQ как plain JSON, а не как HTTP-body;
 *   - class-validator в ручном режиме требует class-transformer
 *     и метаданных @Type/@ValidateNested, которые в связке с
 *     декораторами NestJS часто отваливаются с "undefined.constructor";
 *   - zod уже используется в PolarApiService для валидации ответов,
 *     так что стиль единый.
 *
 * PING в Polar — это { "event": "PING" } без user_id/entity_id.
 * Остальные события содержат полный набор полей.
 * Discriminated union даёт точную типизацию в processEvent().
 */

export const PolarPingSchema = z.object({
  event: z.literal('PING'),
});

export const PolarExerciseSchema = z.object({
  event: z.literal('EXERCISE'),
  user_id: z.coerce.number().int(),
  entity_id: z.string(),
  timestamp: z.string(),
  url: z.string(),
});

export const PolarSleepSchema = z.object({
  event: z.literal('SLEEP'),
  user_id: z.coerce.number().int(),
  entity_id: z.string(),
  timestamp: z.string(),
  url: z.string(),
});

export const PolarActivitySchema = z.object({
  event: z.literal('ACTIVITY'),
  user_id: z.coerce.number().int(),
  entity_id: z.string(),
  timestamp: z.string(),
  url: z.string(),
});

export const PolarWebhookEventSchema = z.discriminatedUnion('event', [
  PolarPingSchema,
  PolarExerciseSchema,
  PolarSleepSchema,
  PolarActivitySchema,
]);

export type PolarWebhookEvent = z.infer<typeof PolarWebhookEventSchema>;
export type PolarPingEvent = z.infer<typeof PolarPingSchema>;
export type PolarExerciseEvent = z.infer<typeof PolarExerciseSchema>;
export type PolarSleepEvent = z.infer<typeof PolarSleepSchema>;
export type PolarActivityEvent = z.infer<typeof PolarActivitySchema>;
