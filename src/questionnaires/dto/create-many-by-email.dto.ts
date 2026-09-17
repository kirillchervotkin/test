// src/questionnaires/dto/create-many-by-email.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateQuestionnaireByEmailDto } from './create-by-email.dto.js';

export class CreateManyByEmailDto {
  @ApiProperty({ type: [CreateQuestionnaireByEmailDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionnaireByEmailDto)
  items: CreateQuestionnaireByEmailDto[];
}
