// src/training/dto/update-training-session.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { SportCode } from '../entities/types/training-session.types.js';

/**
 * Список всех известных кодов видов спорта.
 *
 * Должен совпадать с union-типом `SportCode` в
 * `training-session.types.ts` и с записями в таблице `sport_types`.
 *
 * Хранится как константа, потому что `@IsIn(...)` принимает массив
 * в рантайме, а union-тип стирается при компиляции. Если добавишь
 * новый код в `SportCode` — добавь и здесь.
 */
export const SPORT_CODES: SportCode[] = [
  'running',
  'cycling',
  'swimming',
  'walking',
  'hiking',
  'strength',
  'cardio',
  'yoga',
  'rowing',
  'skiing',
  'skating',
  'tennis',
  'football',
  'basketball',
  'other',
];

/**
 * Body для PATCH /training-sessions/:provider/:externalId.
 *
 * Обновляются ТОЛЬКО поля, принадлежащие пользователю Arbitrator:
 * name, notes, sport. Провайдерские метрики (distance, hr, calories,
 * время, samples) неизменны — они приходят от Polar и не должны
 * редактироваться через API.
 *
 * Семантика полей:
 *   - отсутствие ключа → «не трогать колонку»;
 *   - значение         → «записать»;
 *   - `null`           → «очистить» (для name/notes/sport осмысленно).
 *
 * `null` в `UpdateTrainingSessionData` уходит в БД через
 * `nullsToSql` → SQL-литерал NULL, чтобы обойти protobuf null_type
 * в YDB (см. `TrainingRepository.updateUserFields`).
 *
 * `provider` и `externalId` — path-параметры, не body.
 */
export class UpdateTrainingSessionDto {
  @ApiProperty({
    description: 'Отображаемое имя тренировки. Передайте null, чтобы очистить.',
    required: false,
    nullable: true,
    maxLength: 200,
    example: 'Утренняя пробежка',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @ApiProperty({
    description: 'Заметки пользователя. Передайте null, чтобы очистить.',
    required: false,
    nullable: true,
    maxLength: 2000,
    example: 'Чувствовал себя хорошо, но погода подвела',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiProperty({
    description:
      'Нормализованный код вида спорта. Передайте null, чтобы сбросить в "other".',
    required: false,
    nullable: true,
    enum: SPORT_CODES,
    example: 'running',
  })
  @IsOptional()
  @IsIn(SPORT_CODES)
  sport?: SportCode | null;
}
