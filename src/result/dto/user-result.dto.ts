// src/results/dto/user-results.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateResultItemDto } from './create-result.dto.js';

export class UserResultsDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'UUID пользователя',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    type: [CreateResultItemDto],
    description:
      'Массив результатов пользователя (забеги) – каждый объект содержит ' +
      'isTen, legNumber, опциональный status и одно из полей: ' +
      'time / level / segments',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateResultItemDto)
  items: CreateResultItemDto[];
}
