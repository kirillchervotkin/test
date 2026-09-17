// src/test-grades/dto/create-test-grade.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * DTO создания градации.
 *
 * testTypeId в теле НЕ передаётся — он берётся из URL:
 *   POST /test-types/:testTypeId/grades
 * Так клиент не может случайно создать градацию не тому типу,
 * для которого открыт редактор.
 */
export class CreateTestGradeDto {
  @ApiProperty({
    example: 'A',
    description: 'Название градации (уникально в пределах типа теста)',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  grade: string;

  @ApiProperty({
    example: 1.8,
    description: 'Порог для градации (например, максимальное время в секундах)',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  threshold: number;

  @ApiProperty({
    example: '#4CAF50',
    description: 'Цвет градации в формате HEX (#RRGGBB)',
  })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color in #RRGGBB format',
  })
  color: string;
}
