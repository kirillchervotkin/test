// src/test-grades/dto/test-grade-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class TestGradeResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Суррогатный UUID градации',
  })
  id: string;

  @ApiProperty({
    example: '770e8400-e29b-41d4-a716-446655440002',
    description: 'UUID типа теста, к которому относится градация',
  })
  testTypeId: string;

  @ApiProperty({
    example: 'A',
    description: 'Название градации',
  })
  grade: string;

  @ApiProperty({
    example: 1.8,
    description: 'Порог для градации',
  })
  threshold: number;

  @ApiProperty({
    example: '#4CAF50',
    description: 'Цвет градации в формате HEX (#RRGGBB)',
  })
  color: string;
}
