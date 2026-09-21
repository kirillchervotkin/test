// src/stages/dto/updateStage.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsObject,
  MaxLength,
} from 'class-validator';
import type { StageType, StageFormat } from '../entities/types/stage.types.js';

/**
 * `id` здесь отсутствует намеренно: он берётся из path-параметра
 * маршрута (`PATCH /stages/:id`) и передаётся в маппер отдельным
 * аргументом.
 *
 * `tournamentId` также не меняется: перенос этапа в другой турнир —
 * это delete + create.
 *
 * Валидация `type` ↔ `format` в update-пути НЕ производится:
 * DTO не видит текущего состояния сущности, поэтому согласованность
 * после слияния патча проверяется в сервисе
 * (см. StageService.update → isTypeFormatConsistent).
 */
export class UpdateStageDto {
  @ApiProperty({
    description: 'Новое название этапа (необязательно)',
    required: false,
    example: 'Группа A',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'Новый тип этапа (необязательно)',
    required: false,
    enum: ['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'],
  })
  @IsOptional()
  @IsIn(['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'])
  type?: StageType;

  @ApiProperty({
    description:
      'Новый формат. Чтобы снять значение (для контейнеров), ' +
      'передайте null (необязательно).',
    required: false,
    nullable: true,
    enum: ['ROUND_ROBIN', 'ELIMINATION'],
  })
  @IsOptional()
  @IsIn(['ROUND_ROBIN', 'ELIMINATION'])
  format?: StageFormat | null;

  @ApiProperty({
    description:
      'Новый родительский этап. Чтобы сделать этап корневым, ' +
      'передайте null (необязательно).',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentStageId?: string | null;

  @ApiProperty({
    description: 'Новый порядок среди соседей (необязательно)',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    description:
      'Новые настройки этапа. Чтобы очистить, передайте null (необязательно).',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown> | null;
}
