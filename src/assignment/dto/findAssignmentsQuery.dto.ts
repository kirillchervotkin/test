// src/assignments/dto/findAssignmentsQuery.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsDateString, IsIn } from 'class-validator';

/**
 * Query-параметры для `GET /assignments`.
 *
 * Все фильтры опциональны и комбинируются через AND.
 *
 * `dateFrom` / `dateTo` — фильтр по дате матча (не по дате
 * создания назначения). Требуют JOIN с matches в репозитории.
 *
 * Пагинации нет: назначения всегда смотрят с фильтром
 * (по матчу, судье, роли или дате). Без фильтра список
 * бессмысленен — 2000 записей за сезон никто не листает.
 */
export class FindAssignmentsQueryDto {
  @ApiProperty({
    description: 'Фильтр по ID матча',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  matchId?: string;

  @ApiProperty({
    description: 'Фильтр по ID судьи',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'Фильтр по ID роли',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  fieldRoleId?: string;

  @ApiProperty({
    description: 'Фильтр по дате матча (от, ISO 8601)',
    required: false,
    example: '2023-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({
    description: 'Фильтр по дате матча (до, ISO 8601)',
    required: false,
    example: '2023-09-30T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description:
      'Направление сортировки. Без dateFrom/dateTo сортировка ' +
      'по id, с ними — по дате матча.',
    required: false,
    enum: ['ASC', 'DESC'],
    default: 'ASC',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orderDir?: 'ASC' | 'DESC';
}
