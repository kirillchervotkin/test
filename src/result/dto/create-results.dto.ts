import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateResultItemDto } from './create-result.dto.js';

export class CreateResultsDto {
  @ApiProperty({
    type: [CreateResultItemDto],
    description: 'Массив результатов (от 1 до 6 забегов)',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => CreateResultItemDto)
  items: CreateResultItemDto[];

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
