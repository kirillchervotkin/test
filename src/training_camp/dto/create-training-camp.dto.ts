// src/training-camps/dto/create-training-camp.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Matches, IsBoolean } from 'class-validator';

export class CreateTrainingCampDto {
  @ApiProperty({
    description: 'Название тренировочного лагеря',
    example: 'Летний лагерь чемпионов',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Описание тренировочного лагеря (опционально)',
    required: false,
    example: 'Сбор судей РПЛ',
  })
  @IsString()
  @IsOptional()
  description?: string; // Без '| null'

  @ApiProperty({
    description: 'Дата начала проведения лагеря в формате YYYY-MM-DD',
    format: 'date',
    example: '2023-07-15',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дата начала должна быть в формате YYYY-MM-DD',
  })
  startDate: string;

  @ApiProperty({
    description: 'Дата окончания проведения лагеря в формате YYYY-MM-DD',
    format: 'date',
    example: '2023-07-25',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дата окончания должна быть в формате YYYY-MM-DD',
  })
  endDate: string;

  @ApiProperty({
    description: 'Местоположение или адрес проведения лагеря (опционально)',
    required: false,
    example: 'Спортивный комплекс "Олимпийский", Москва',
  })
  @IsString()
  @IsOptional()
  location?: string; // Без '| null'

  @ApiProperty({
    description: 'Статус активности лагеря (по умолчанию активен)',
    default: true,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
