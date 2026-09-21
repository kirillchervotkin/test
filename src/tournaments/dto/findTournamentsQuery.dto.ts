// src/tournaments/dto/findTournamentsQuery.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';
import type { TournamentType } from '../entities/types/tournament.types.js';

export class FindTournamentsQueryDto {
  @ApiProperty({
    description: 'Фильтр по сезону (точное совпадение)',
    required: false,
    example: '2023/24',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  season?: string;

  @ApiProperty({
    description: 'Фильтр по типу турнира',
    required: false,
    enum: ['LEAGUE', 'CUP', 'SUPER_CUP'],
  })
  @IsOptional()
  @IsIn(['LEAGUE', 'CUP', 'SUPER_CUP'])
  type?: TournamentType;

  @ApiProperty({
    description: 'Поле сортировки',
    required: false,
    enum: ['name', 'season', 'createdAt'],
    default: 'season',
  })
  @IsOptional()
  @IsIn(['name', 'season', 'createdAt'])
  orderBy?: 'name' | 'season' | 'createdAt';

  @ApiProperty({
    description: 'Направление сортировки',
    required: false,
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDir?: 'ASC' | 'DESC';
}
