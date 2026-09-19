import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { TemplateSchema } from '../entities/types/schedule.types.js';

export class CreateTemplateDto {
  @ApiProperty({ description: 'Название' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Описание',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string | null;

  @ApiProperty({ description: 'Версия' })
  @IsInt()
  @Min(1)
  @Max(4294967295)
  version!: number;

  @ApiProperty({ description: 'Шаблон доступен' })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({ type: Object, description: 'Схема турнира' })
  @IsObject()
  schema!: TemplateSchema;
}
