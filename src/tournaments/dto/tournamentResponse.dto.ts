// src/tournaments/dto/tournamentResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import type { TournamentType } from '../entities/types/tournament.types.js';

export class TournamentResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор турнира',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Название турнира',
    example: 'Кубок России 2023/24',
  })
  name: string;

  @ApiProperty({
    description: 'Сезон турнира',
    example: '2023/24',
  })
  season: string;

  @ApiProperty({
    description: 'Тип турнира',
    example: 'CUP',
    enum: ['LEAGUE', 'CUP', 'SUPER_CUP'],
  })
  type: TournamentType;

  @ApiProperty({
    description: 'Дата начала турнира',
    example: '2023-07-01T00:00:00.000Z',
    nullable: true,
  })
  startDate: Date | null;

  @ApiProperty({
    description: 'Дата окончания турнира',
    example: '2024-05-31T00:00:00.000Z',
    nullable: true,
  })
  endDate: Date | null;

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
