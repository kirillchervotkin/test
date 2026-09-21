// src/cities/dto/updateCity.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

/**
 * `id` здесь отсутствует намеренно: он берётся из path-параметра
 * маршрута (`PATCH /cities/:id`) и передаётся в маппер отдельным
 * аргументом.
 *
 * Семантика `undefined` vs `null`:
 *   - `undefined` — поле не передано, не трогаем в БД.
 *   - `null` — явное «обнулить». Для `region` — очистить регион.
 */
export class UpdateCityDto {
  @ApiProperty({
    description: 'Новое название города (необязательно)',
    required: false,
    example: 'Москва',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description:
      'Новый регион. Чтобы очистить, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: 'Московская область',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  region?: string | null;
}
