import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
} from 'class-validator';

export class UpdateAttemptDto {
  @ApiProperty({
    description: 'Идентификатор попытки (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Идентификатор пользователя (UUID) – опционально',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({
    description: 'Тип теста – опционально',
    required: false,
    example: 'endurance',
  })
  @IsString()
  @IsOptional()
  testType?: string;

  @ApiProperty({
    description: 'Номер попытки – опционально',
    required: false,
    example: 2,
  })
  @IsInt()
  @IsOptional()
  attemptNumber?: number;

  @ApiProperty({
    description:
      'Дата и время проведения теста в формате ISO 8601 – опционально',
    required: false,
    format: 'date-time',
    example: '2026-08-09T14:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  testDate?: string;

  @ApiProperty({
    description: 'Идентификатор тренировочного лагеря (UUID) – опционально',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  @IsOptional()
  trainingCampId?: string;
}
