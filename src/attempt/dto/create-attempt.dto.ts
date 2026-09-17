import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsInt, IsDateString } from 'class-validator';

export class CreateAttemptDto {
  @ApiProperty({
    description: 'Идентификатор пользователя (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Тип теста (например, speed, endurance)',
    example: 'speed',
  })
  @IsString()
  testType: string;

  @ApiProperty({
    description:
      'Номер попытки (порядковый номер для данного пользователя и типа теста)',
    example: 1,
  })
  @IsInt()
  attemptNumber: number;

  @ApiProperty({
    description: 'Дата и время проведения теста в формате ISO 8601',
    format: 'date-time',
    example: '2026-08-08T10:30:00Z',
  })
  @IsDateString()
  testDate: string;

  @ApiProperty({
    description: 'Идентификатор тренировочного лагеря (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  trainingCampId: string;
}
