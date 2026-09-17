// src/questionnaires/dto/create-questionnaires.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateQuestionnaireDto } from './create-questionnaire.dto.js';

export class CreateQuestionnairesDto {
  @ApiProperty({ type: [CreateQuestionnaireDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionnaireDto)
  items: CreateQuestionnaireDto[];
}
