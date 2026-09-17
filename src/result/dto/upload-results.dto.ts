// src/results/dto/upload-results.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsUUID,
  ValidateNested,
  IsOptional,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserResultsDto } from './user-result.dto.js';

export class UploadResultsDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description:
      'UUID тренировочного лагеря (опционально, если не указан в каждом пользователе)',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  trainingCampId?: string;

  @ApiProperty({
    type: [UserResultsDto],
    description: 'Массив пользователей с их результатами',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UserResultsDto)
  users: UserResultsDto[];

  @ApiProperty({
    description:
      'Типы тестов, по которым нужно оценить результаты. Минимум один. ' +
      'Для женских результатов обычно два: женский и мужской.',
    example: [
      '770e8400-e29b-41d4-a716-446655440002',
      '880e8400-e29b-41d4-a716-446655440003',
    ],
    type: [String],
    minItems: 1,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  testTypeIds: string[];
}
