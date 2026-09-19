import { ApiProperty } from '@nestjs/swagger';

export class CityResponseDto {
  @ApiProperty({
    description: 'ID города',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Название города', example: 'Москва' })
  name: string;

  @ApiProperty({
    description: 'Дата создания',
    example: '2023-09-19T20:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата обновления',
    example: '2023-09-19T20:00:00.000Z',
  })
  updatedAt: string;
}
