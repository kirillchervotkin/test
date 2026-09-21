// src/stages/dto/findStagesQuery.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsIn, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import type { StageType } from '../entities/types/stage.types.js';

/**
 * Query-параметры для `GET /tournaments/:tournamentId/stages`.
 *
 * `tournamentId` берётся из path, не из query.
 *
 * `rootOnly` — удобный флаг для получения только корневых этапов
 * (parentStageId IS NULL). Вместо того чтобы клиент передавал
 * `parentStageId=null` (что в query-строке выглядит странно),
 * используется явный boolean.
 */
export class FindStagesQueryDto {
  @ApiProperty({
    description: 'Фильтр по типу этапа',
    required: false,
    enum: ['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'],
  })
  @IsOptional()
  @IsIn(['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'])
  type?: StageType;

  @ApiProperty({
    description:
      'Вернуть только корневые этапы (parentStageId IS NULL). ' +
      'Игнорируется, если передан parentStageId.',
    required: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  rootOnly?: boolean;

  @ApiProperty({
    description:
      'Вернуть только дочерние этапы указанного родителя. ' +
      'Имеет приоритет над rootOnly.',
    required: false,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  parentStageId?: string;
}
