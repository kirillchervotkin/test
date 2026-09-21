// src/matches/dto/findMatchesQuery.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsDateString,
  IsIn,
} from 'class-validator';

/**
 * Query-параметры для `GET /matches`.
 *
 * Все фильтры опциональны и комбинируются через AND.
 *
 * `teamId` — особый случай: в репозитории он превращается в
 * `WHERE home_team_id = X OR away_team_id = X`. YDB обычно
 * использует только один индекс, поэтому такой запрос будет
 * full-scan по одному из индексов. Для масштаба «тысячи матчей»
 * это приемлемо.
 *
 * Пагинация нужна: матчей сотни и тысячи, в отличие от турниров
 * и этапов.
 */
export class FindMatchesQueryDto {
  @ApiProperty({
    description: 'Фильтр по ID турнира',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @ApiProperty({
    description: 'Фильтр по ID этапа',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  stageId?: string;

  @ApiProperty({
    description: 'Фильтр по ID города',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @ApiProperty({
    description: 'Фильтр по ID команды (home или away)',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  teamId?: string;

  @ApiProperty({
    description: 'Фильтр по номеру тура',
    required: false,
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  tourNumber?: number;

  @ApiProperty({
    description: 'Фильтр по дате (от, ISO 8601)',
    required: false,
    example: '2023-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Фильтр по дате (до, ISO 8601)',
    required: false,
    example: '2023-09-30T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: 'Количество записей на страницу (по умолчанию 100)',
    required: false,
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({
    description: 'Смещение (по умолчанию 0)',
    required: false,
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiProperty({
    description: 'Поле сортировки',
    required: false,
    enum: ['matchDate', 'tourNumber'],
    default: 'matchDate',
  })
  @IsOptional()
  @IsIn(['matchDate', 'tourNumber'])
  orderBy?: 'matchDate' | 'tourNumber';

  @ApiProperty({
    description: 'Направление сортировки',
    required: false,
    enum: ['ASC', 'DESC'],
    default: 'ASC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDir?: 'ASC' | 'DESC';
}
