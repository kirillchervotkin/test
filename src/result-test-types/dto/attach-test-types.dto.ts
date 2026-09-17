// src/result-test-types/dto/attach-test-types.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayNotEmpty, ArrayUnique } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class AttachTestTypesDto {
  @ApiProperty({
    description:
      'ID типов тестов для привязки к результату. Для женских результатов обычно два: женский (родной) и мужской (для сравнения).',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    ],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @Constraint({
    dbField: 'test_type_id',
    messages: {
      foreignKey: 'validation.TEST_TYPE_NOT_FOUND',
    },
  })
  testTypeIds: string[];
}
