// src/training-camps/dto/training-camp.response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class TrainingCampResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор лагерной программы',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Название лагерной программы',
    example: 'Летний лагерь чемпионов',
  })
  name: string;

  @ApiProperty({
    description: 'Описание лагерной программы (опционально)',
    nullable: true,
    required: false,
    example: 'Интенсивная подготовка спортсменов высокого уровня.',
  })
  description?: string | null;

  @ApiProperty({
    description: 'Дата начала проведения лагеря в формате YYYY-MM-DD',
    type: String,
    format: 'date',
    example: '2023-07-15',
  })
  startDate: string; // Формат ISO-8601 ('YYYY-MM-DD')

  @ApiProperty({
    description: 'Дата окончания проведения лагеря в формате YYYY-MM-DD',
    type: String,
    format: 'date',
    example: '2023-07-25',
  })
  endDate: string; // Формат ISO-8601 ('YYYY-MM-DD')

  @ApiProperty({
    description: 'Местоположение или адрес проведения лагеря (опционально)',
    nullable: true,
    required: false,
    example: 'Спортивный комплекс "Олимпийский", Москва',
  })
  location?: string | null;

  @ApiProperty({
    description: 'Статус активности лагерной программы',
    default: true,
    example: true,
  })
  isActive: boolean;
}
