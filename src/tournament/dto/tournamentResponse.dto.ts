import { ApiProperty } from '@nestjs/swagger';
import { TournamentStatus } from './createTournament.dto.js';

export class TournamentResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор турнира',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Название турнира',
    example: 'Чемпионат мира 2023',
  })
  name: string;

  @ApiProperty({
    description: 'Описание турнира',
    example: 'Ежегодный чемпионат мира по футболу',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Дата начала турнира',
    example: '2023-06-01',
  })
  startDate: string;

  @ApiProperty({
    description: 'Дата окончания турнира',
    example: '2023-07-15',
  })
  endDate: string;

  @ApiProperty({
    description: 'Статус турнира',
    enum: TournamentStatus,
    example: TournamentStatus.COMPLETED,
  })
  status: TournamentStatus;

  @ApiProperty({
    description: 'Дата создания записи',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2023-01-02T00:00:00.000Z',
  })
  updatedAt: string;
}
