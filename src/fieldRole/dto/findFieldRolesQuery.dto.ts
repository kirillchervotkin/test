// src/field-roles/dto/findFieldRolesQuery.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

/**
 * Query-параметры для `GET /field-roles`.
 *
 * `code` — точное совпадение (для поиска конкретной роли,
 * например «найти REFEREE»).
 * `name` — частичное совпадение (для автокомплита в админке,
 * если понадобится).
 *
 * Пагинации нет: ролей фиксированное количество (5).
 * Сортировка по умолчанию — `sortOrder` (естественный порядок
 * отображения в UI: Главный судья, Помощник, Резервный, VAR, AVAR).
 */
export class FindFieldRolesQueryDto {
  @ApiProperty({
    description: 'Фильтр по коду роли (точное совпадение)',
    required: false,
    example: 'REFEREE',
    enum: ['REFEREE', 'ASSISTANT', 'RESERVE', 'VAR', 'AVAR'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({
    description: 'Фильтр по имени (частичное совпадение)',
    required: false,
    example: 'судья',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'Поле сортировки',
    required: false,
    enum: ['sortOrder', 'code', 'name'],
    default: 'sortOrder',
  })
  @IsOptional()
  @IsIn(['sortOrder', 'code', 'name'])
  orderBy?: 'sortOrder' | 'code' | 'name';

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
