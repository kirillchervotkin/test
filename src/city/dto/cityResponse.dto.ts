// src/cities/dto/cityResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class CityResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор города',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Название города',
    example: 'Москва',
  })
  name: string;

  @ApiProperty({
    description: 'Регион/область/край',
    example: 'Московская область',
    nullable: true,
  })
  region: string | null;

  @ApiProperty({
    description: 'Дата и время создания записи',
    example: '2023-06-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата и время последнего обновления',
    example: '2023-06-15T10:00:00.000Z',
  })
  updatedAt: Date;
}
