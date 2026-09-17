// src/test-types/dto/response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import type { TestParameter } from '../entities/types/test-type.types.js';

export class TestTypeResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор типа теста',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Название типа теста',
    example: 'Бег 100 м (муж)',
  })
  name: string;

  @ApiProperty({
    description: 'Пол, для которого предназначен тип теста',
    example: 'male',
    enum: ['male', 'female'],
  })
  gender: string;

  @ApiProperty({
    description:
      'Параметр оценки, выведенный из заполненных порогов: ' +
      'time — только failThresholdTime; ' +
      'segments — только failThresholdSegments; ' +
      'level — failThresholdLevel + failThresholdSegments.',
    example: 'time',
    enum: ['time', 'level', 'segments'],
  })
  parameter: TestParameter;

  @ApiProperty({
    description:
      'Порог несдачи для time-теста. Заполнен, если тест оценивается по времени.',
    example: 15.0,
    nullable: true,
  })
  failThresholdTime: number | null;

  @ApiProperty({
    description:
      'Порог несдачи по уровню (вещественный). ' +
      'Заполнен вместе с failThresholdSegments для level-теста.',
    example: 10.5,
    nullable: true,
  })
  failThresholdLevel: number | null;

  @ApiProperty({
    description:
      'Порог несдачи по отрезкам. Заполнен для segments- и level-тестов.',
    example: 5,
    nullable: true,
  })
  failThresholdSegments: number | null;

  @ApiProperty({
    description:
      'Количество попыток, которое нужно пробежать. ' +
      'Заполнено только для time-тестов (parameter = "time").',
    example: 2,
    nullable: true,
  })
  attemptsCount: number | null;
}
