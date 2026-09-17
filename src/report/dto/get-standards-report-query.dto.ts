// src/standards/dto/get-standards-report-query.dto.ts

import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetStandardsReportQueryDto {
  @ApiProperty({
    description: 'ID списка пользователей (обязательный)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  listId: string;

  @ApiProperty({
    description: 'ID типа теста (обязательный)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  testTypeId: string;

  @ApiProperty({
    description:
      'ID тренировочного лагеря (опционально, для фильтрации отчётов ' +
      'по конкретному лагерю)',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  trainingCampId?: string;
}
