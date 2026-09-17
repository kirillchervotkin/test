// src/results/dto/response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { RESULT_STATUSES } from '../entities/types/result.types.js';
import type { ResultStatus } from '../entities/types/result.types.js';

export class ResultResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Суррогатный UUID результата',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID пользователя',
  })
  userId: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'UUID тренировочного лагеря',
  })
  trainingCampId: string;

  @ApiProperty({
    example: false,
    description: 'true – забег на 10 м, false – основной',
  })
  isTen: boolean;

  @ApiProperty({
    example: 1,
    description: 'Номер забега (1, 2 или 3)',
  })
  legNumber: number;

  @ApiProperty({
    description:
      'Статус результата: ' +
      '"completed" — зачтён, ' +
      '"not_credited" — выполнен, но не зачтён (техническая ошибка), ' +
      '"not_admitted" — спортсмен не допущен к тесту.',
    enum: RESULT_STATUSES,
    example: 'completed',
  })
  status: ResultStatus;

  @ApiProperty({
    example: 12.34,
    description: 'Время в секундах (для обычных тестов)',
    nullable: true,
  })
  time: number | null;

  @ApiProperty({
    example: 16,
    description: 'Уровень (для теста «уровень + отрезки»)',
    nullable: true,
  })
  level: number | null;

  @ApiProperty({
    example: 3,
    description: 'Количество отрезков (для тестов с отрезками)',
    nullable: true,
  })
  segments: number | null;

  @ApiProperty({
    example: [
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ],
    description:
      'UUID типов тестов, привязанных к результату (внешние ключи на test_types)',
    type: [String],
  })
  testTypeIds: string[];
}
