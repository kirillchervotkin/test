import { ApiProperty } from '@nestjs/swagger';

export class GroupResponseDto {
  @ApiProperty({ example: 1, description: 'ID группы' })
  id: number;

  @ApiProperty({ example: 'Группа A', description: 'Название группы' })
  name: string;

  @ApiProperty({ example: 1, description: 'ID турнира' })
  tournamentId: number;

  @ApiProperty({
    example: 'Группа сильнейших команд',
    description: 'Описание группы',
    required: false,
  })
  description?: string;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Дата создания',
  })
  createdAt: string;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Дата обновления',
  })
  updatedAt: string;
}
