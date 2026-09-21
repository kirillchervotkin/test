// src/stages/dto/stageResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import type { StageType, StageFormat } from '../entities/types/stage.types.js';

export class StageResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор этапа',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID турнира, к которому относится этап',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  tournamentId: string;

  @ApiProperty({
    description: 'ID родительского этапа (null для корневых)',
    example: null,
    nullable: true,
  })
  parentStageId: string | null;

  @ApiProperty({
    description: 'Название этапа',
    example: 'Группа A',
  })
  name: string;

  @ApiProperty({
    description: 'Тип этапа',
    example: 'GROUP',
    enum: ['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'],
  })
  type: StageType;

  @ApiProperty({
    description: 'Формат игры. null для контейнеров STAGE/PLAYOFF.',
    example: 'ROUND_ROBIN',
    enum: ['ROUND_ROBIN', 'ELIMINATION'],
    nullable: true,
  })
  format: StageFormat | null;

  @ApiProperty({
    description: 'Порядок среди соседей',
    example: 1,
  })
  sortOrder: number;

  @ApiProperty({
    description: 'Гибкие параметры этапа',
    example: { rounds: 2, pointsForWin: 3 },
    nullable: true,
  })
  settings: Record<string, unknown> | null;

  @ApiProperty({
    description: 'Дата и время создания записи',
    example: '2023-06-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата и время последнего обновления',
    example: '2023-06-15T10:00:00.000Z',
  })
  updatedAt: Date;
}
