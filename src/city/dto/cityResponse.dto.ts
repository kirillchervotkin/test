import { ApiProperty } from '@nestjs/swagger';

export class CityResponseDto {
  @ApiProperty({ description: 'ID города', example: 1 })
  id: number;

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
