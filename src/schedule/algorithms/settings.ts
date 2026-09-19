import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import type {
  Settings,
  TemplateSchema,
  TemplateStage,
} from '../entities/types/schedule.types.js';
const id = z
  .string()
  .regex(/^[1-9]\d{0,19}$/)
  .refine((v) => BigInt(v) <= 18446744073709551615n);
const rule = z
  .object({
    slotName: z.string().min(1),
    sourceType: z.enum(['GROUP', 'WINNER', 'LOSER']),
    sourceStageId: id.optional(),
    sourceStageKey: z.string().optional(),
    sourceGroupName: z.string().optional(),
    sourcePosition: z.number().int().positive().optional(),
    sourceMatchId: id.optional(),
  })
  .strict();
const settings = z
  .object({
    rounds: z.number().int().min(1).max(8).optional(),
    pointsForWin: z.number().nonnegative().optional(),
    pointsForDraw: z.number().nonnegative().optional(),
    pointsForLoss: z.number().nonnegative().optional(),
    tieBreakers: z
      .array(z.enum(['headToHead', 'goalDifference', 'goalsScored', 'wins']))
      .optional(),
    legsPerRound: z.number().int().min(1).max(2).optional(),
    neutralVenue: z.boolean().optional(),
    dropToLowerBracket: z.boolean().optional(),
    grandFinalReset: z.boolean().optional(),
    qualification: z.array(rule).optional(),
    decisions: z.record(id, id).optional(),
  })
  .strict();
const stage: z.ZodType<TemplateStage> = z.lazy(() =>
  z
    .object({
      key: z.string().min(1),
      name: z.string().min(1),
      type: z.enum(['STAGE', 'GROUP', 'ROUND', 'PLAYOFF']),
      format: z.enum(['ROUND_ROBIN', 'SINGLE_ELIM', 'DOUBLE_ELIM']),
      settings: settings.optional(),
      slots: z
        .array(
          z
            .object({
              name: z.string().min(1),
              seed: z.number().int().positive().optional(),
              teamId: id.optional(),
            })
            .strict(),
        )
        .max(128)
        .optional(),
      children: z.array(stage).optional(),
    })
    .strict(),
);
const template = z
  .object({
    name: z.string().min(1),
    type: z.enum(['LEAGUE', 'CUP', 'SUPER_CUP']),
    cityId: id,
    intervalDays: z.number().int().positive().optional(),
    stages: z.array(stage).min(1),
  })
  .strict();
export class ScheduleSettings {
  static async parse(value: unknown): Promise<Settings> {
    const result = settings.safeParse(value ?? {});
    if (!result.success)
      throw new BadRequestException(
        'Некорректные настройки этапа: ' +
          result.error.issues
            .map((i) => i.path.join('.') + ': ' + i.message)
            .join('; '),
      );
    return result.data;
  }
  static async template(value: unknown): Promise<TemplateSchema> {
    const result = template.safeParse(value);
    if (!result.success)
      throw new BadRequestException('Некорректная схема шаблона');
    const seen = new Set<string>();
    let count = 0;
    const visit = async (
      nodes: TemplateStage[],
      depth: number,
    ): Promise<void> => {
      if (depth > 16)
        throw new BadRequestException('Глубина этапов превышает 16');
      for (const node of nodes) {
        if (seen.has(node.key) || ++count > 128)
          throw new BadRequestException(
            'Ключи этапов должны быть уникальными; максимум 128 этапов',
          );
        seen.add(node.key);
        await visit(node.children ?? [], depth + 1);
      }
    };
    await visit(result.data.stages, 0);
    return result.data;
  }
}
