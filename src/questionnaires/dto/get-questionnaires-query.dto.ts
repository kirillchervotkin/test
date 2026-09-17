// src/questionnaires/dto/get-questionnaires-query.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsArray, ArrayMinSize } from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class GetQuestionnairesQueryDto {
  @ApiProperty({
    required: false,
    type: [String],
    description: 'Фильтр по спискам пользователей',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @Transform(
    ({ value }: TransformFnParams) =>
      (Array.isArray(value) ? value : [value]) as string[],
  )
  listIds?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Фильтр по пользователям',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  @Transform(
    ({ value }: TransformFnParams) =>
      (Array.isArray(value) ? value : [value]) as string[],
  )
  userIds?: string[];

  @ApiProperty({ required: false, type: Number, default: 100 })
  @IsOptional()
  @Transform(({ value }: TransformFnParams) => {
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  })
  limit?: number;

  @ApiProperty({ required: false, type: Number, default: 0 })
  @IsOptional()
  @Transform(({ value }: TransformFnParams) => {
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  })
  offset?: number;
}
