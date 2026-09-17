// src/test-grades/dto/apply-test-grade-diff.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsUUID,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Элемент для создания градации в рамках diff.
 * testTypeId не указывается — он берётся из URL (PATCH /test-types/:id/grades).
 */
export class ApplyDiffCreateItemDto {
  @ApiProperty({
    example: 'D',
    description: 'Название новой градации',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  grade: string;

  @ApiProperty({
    example: 2.4,
    description: 'Порог для градации',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  threshold: number;

  @ApiProperty({
    example: '#2196F3',
    description: 'Цвет градации в формате HEX (#RRGGBB)',
  })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color in #RRGGBB format',
  })
  color: string;
}

/**
 * Элемент для обновления градации в рамках diff.
 * id обязателен, остальные поля опциональны.
 */
export class ApplyDiffUpdateItemDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID обновляемой градации',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    required: false,
    example: 'A+',
    description: 'Новое название градации',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  grade?: string;

  @ApiProperty({
    required: false,
    example: 1.75,
    description: 'Новый порог для градации',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  threshold?: number;

  @ApiProperty({
    required: false,
    example: '#FF5722',
    description: 'Новый цвет градации в формате HEX (#RRGGBB)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color in #RRGGBB format',
  })
  color?: string;
}

/**
 * Полный набор изменений градаций одного типа теста.
 *
 * Применяется атомарно, порядок внутри транзакции:
 *   delete → update → create.
 *
 * Все три поля опциональны — если что-то не передано, считается
 * пустым массивом (соответствующая операция не выполняется).
 */
export class ApplyTestGradeDiffDto {
  @ApiProperty({
    required: false,
    type: [ApplyDiffCreateItemDto],
    description: 'Градации для создания',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyDiffCreateItemDto)
  create?: ApplyDiffCreateItemDto[];

  @ApiProperty({
    required: false,
    type: [ApplyDiffUpdateItemDto],
    description: 'Градации для обновления',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyDiffUpdateItemDto)
  update?: ApplyDiffUpdateItemDto[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'UUID градаций для удаления',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  delete?: string[];
}
