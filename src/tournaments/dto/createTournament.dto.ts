// src/tournaments/dto/createTournament.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsDateString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import type { TournamentType } from '../entities/types/tournament.types.js';

export class CreateTournamentDto {
  @ApiProperty({
    description: 'Название турнира',
    example: 'Кубок России 2023/24',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Сезон турнира в формате YYYY/YY',
    example: '2023/24',
  })
  @IsString()
  @MaxLength(20)
  season: string;

  @ApiProperty({
    description: 'Тип турнира',
    example: 'CUP',
    enum: ['LEAGUE', 'CUP', 'SUPER_CUP'],
  })
  @IsIn(['LEAGUE', 'CUP', 'SUPER_CUP'])
  type: TournamentType; // ← ключевое: TournamentType, а не string

  @ApiProperty({
    description: 'Дата начала турнира (ISO 8601)',
    example: '2023-07-01',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiProperty({
    description: 'Дата окончания турнира (ISO 8601)',
    example: '2024-05-31',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}
