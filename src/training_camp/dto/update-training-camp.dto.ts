// src/training-camps/dto/update-training-camp.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsOptional,
  Matches,
  IsBoolean,
} from 'class-validator';

export class UpdateTrainingCampDto {
  @ApiProperty({
    description: 'Идентификатор лагеря для обновления',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'Обновлённое название лагеря (необязательно)',
    required: false,
    example: 'Зимние спортивные сборы',
  })
  @IsString()
  @IsOptional()
  name?: string; // Без '| null'

  @ApiProperty({
    description: 'Новое описание лагеря (необязательно)',
    required: false,
    example: 'Сборы для подготовки к зимним чемпионатам.',
  })
  @IsString()
  @IsOptional()
  description?: string; // Без '| null'

  @ApiProperty({
    description: 'Новая дата начала лагеря (необязательно)',
    format: 'date',
    example: '2024-01-05',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дата начала должна быть в формате YYYY-MM-DD',
  })
  @IsOptional()
  startDate?: string; // Без '| null'

  @ApiProperty({
    description: 'Новая дата окончания лагеря (необязательно)',
    format: 'date',
    example: '2024-01-15',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дата окончания должна быть в формате YYYY-MM-DD',
  })
  @IsOptional()
  endDate?: string; // Без '| null'

  @ApiProperty({
    description: 'Обновленное место проведения лагеря (необязательно)',
    required: false,
    example: 'Ледовый дворец спорта',
  })
  @IsString()
  @IsOptional()
  location?: string; // Без '| null'

  @ApiProperty({
    description: 'Новый статус активности лагеря (необязательно)',
    required: false,
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
