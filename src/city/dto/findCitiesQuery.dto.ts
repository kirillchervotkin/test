// src/cities/dto/findCitiesQuery.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

/**
 * Query-параметры для `GET /cities`.
 *
 * `search` — удобный алиас для частичного поиска по имени.
 * Если передан, используется как `filter.name` и маршрутизируется
 * в `searchByName` для автокомплита. Отдельный параметр введён
 * для читаемости URL: `?search=мос` вместо `?name=мос`.
 *
 * Пагинации нет: городов в системе сотни максимум.
 */
export class FindCitiesQueryDto {
  @ApiProperty({
    description: 'Поиск по названию города (частичное совпадение)',
    required: false,
    example: 'мос',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiProperty({
    description: 'Фильтр по региону (точное совпадение)',
    required: false,
    example: 'Московская область',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  region?: string;

  @ApiProperty({
    description: 'Поле сортировки',
    required: false,
    enum: ['name', 'region', 'createdAt'],
    default: 'name',
  })
  @IsOptional()
  @IsIn(['name', 'region', 'createdAt'])
  orderBy?: 'name' | 'region' | 'createdAt';

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
