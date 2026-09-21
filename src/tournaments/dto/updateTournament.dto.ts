// src/tournaments/dto/update-tournament.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsDateString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import type { TournamentType } from '../entities/types/tournament.types.js';

/**
 * `id` здесь отсутствует намеренно: он берётся из path-параметра
 * маршрута (`PATCH /tournaments/:id`) и передаётся в маппер
 * отдельным аргументом.
 */
export class UpdateTournamentDto {
  @ApiProperty({
    description: 'Новое название турнира (необязательно)',
    required: false,
    example: 'Кубок России 2023/24',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'Новый сезон (необязательно)',
    required: false,
    example: '2023/24',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  season?: string;

  @ApiProperty({
    description: 'Новый тип турнира (необязательно)',
    required: false,
    enum: ['LEAGUE', 'CUP', 'SUPER_CUP'],
  })
  @IsOptional()
  @IsIn(['LEAGUE', 'CUP', 'SUPER_CUP'])
  type?: TournamentType; // ← было string

  @ApiProperty({
    description:
      'Новая дата начала. Чтобы снять значение, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: '2023-07-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string | null;

  @ApiProperty({
    description:
      'Новая дата окончания. Чтобы снять значение, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: '2024-05-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;
}
