// src/teams/dto/findTeamsQuery.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsUUID, MaxLength } from 'class-validator';

/**
 * Query-параметры для `GET /teams`.
 *
 * `search` — удобный алиас для частичного поиска по имени.
 * Если передан, маршрутизируется в `searchByName` для автокомплита.
 *
 * `shortName` — фильтр по короткому имени (частичное совпадение).
 * `cityId` — фильтр по домашнему городу (точное совпадение).
 *
 * Пагинации нет: команд в системе сотни максимум.
 */
export class FindTeamsQueryDto {
  @ApiProperty({
    description: 'Поиск по названию команды (частичное совпадение)',
    required: false,
    example: 'Зен',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiProperty({
    description: 'Фильтр по короткому имени (частичное совпадение)',
    required: false,
    example: 'ЗЕН',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiProperty({
    description: 'Фильтр по домашнему городу (точное совпадение)',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @ApiProperty({
    description: 'Поле сортировки',
    required: false,
    enum: ['name', 'shortName'],
    default: 'name',
  })
  @IsOptional()
  @IsIn(['name', 'shortName'])
  orderBy?: 'name' | 'shortName';

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
