import { ApiProperty } from '@nestjs/swagger';

export class AttemptResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор попытки',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Идентификатор пользователя',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  userId: string;

  @ApiProperty({
    description: 'Тип теста',
    example: 'speed',
  })
  testType: string;

  @ApiProperty({
    description: 'Номер попытки',
    example: 1,
  })
  attemptNumber: number;

  @ApiProperty({
    description: 'Дата и время проведения теста в формате ISO 8601',
    format: 'date-time',
    example: '2026-08-08T10:30:00Z',
  })
  testDate: string;

  @ApiProperty({
    description: 'Идентификатор тренировочного лагеря',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  trainingCampId: string;
}
