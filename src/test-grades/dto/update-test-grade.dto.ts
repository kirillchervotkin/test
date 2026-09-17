// src/test-grades/dto/update-test-grade.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * Частичное обновление градации.
 *
 * testTypeId не обновляется: «переезд» градации в другой тип теста —
 * это отдельный сценарий (delete + create), а не update.
 */
export class UpdateTestGradeDto {
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
