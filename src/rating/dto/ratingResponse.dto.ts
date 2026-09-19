import { ApiProperty } from '@nestjs/swagger';

export class RatingResponseDto {
  @ApiProperty({ description: 'ID оценки', example: 1 })
  id: number;

  @ApiProperty({ description: 'ID назначения', example: 1 })
  assignmentId: number;

  @ApiProperty({ description: 'ID матча', example: 1 })
  matchId: string;

  @ApiProperty({ description: 'ID пользователя (судьи)', example: 101 })
  userId: number;

  @ApiProperty({ description: 'ID роли', example: 1 })
  roleId: number;

  @ApiProperty({ description: 'Оценка', example: 8 })
  rating: number;

  @ApiProperty({
    description: 'Комментарий к оценке',
    example: 'Хорошая работа, но можно улучшить реакцию на игровые ситуации',
    required: false,
  })
  comment?: string;

  @ApiProperty({
    description: 'Дата создания',
    example: '2023-09-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата обновления',
    example: '2023-09-01T00:00:00.000Z',
  })
  updatedAt: string;
}
