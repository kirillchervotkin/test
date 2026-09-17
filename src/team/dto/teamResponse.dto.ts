import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class TeamResponseDto {
  @ApiProperty({ description: 'ID команды', example: 1 })
  id: number;

  @ApiProperty({ description: 'Название команды', example: 'Спартак' })
  name: string;

  @ApiProperty({
    description: 'Место проведения матча',
    example: 'Санкт-Петербург',
  })
  @IsInt()
  @Min(1)
  cityId: number;

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
