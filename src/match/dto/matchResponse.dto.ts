import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class MatchResponseDto {
  @ApiProperty({ description: 'ID матча', example: 1 })
  id: number;

  @ApiProperty({ description: 'ID турнира', example: 2 })
  tournamentId: number;

  @ApiProperty({
    description: 'ID группы (если есть)',
    example: 1,
    required: false,
    nullable: true,
  })
  groupId?: number | null;

  @ApiProperty({
    description: 'Дата и время матча',
    example: '2024-06-15T18:00:00Z',
  })
  matchDate: string;

  @ApiProperty({
    description: 'Место проведения матча',
    example: 'Санкт-Петербург',
  })
  @IsInt()
  @Min(1)
  cityId: number;

  @ApiProperty({
    description: 'ID команды хозяев',
    example: 1,
  })
  homeTeamId: number;

  @ApiProperty({
    description: 'ID команды гостей',
    example: 2,
  })
  awayTeamId: number;

  @ApiProperty({
    description: 'Счет хозяев',
    example: 2,
    required: false,
    nullable: true,
  })
  homeScore?: number | null;

  @ApiProperty({
    description: 'Счет гостей',
    example: 1,
    required: false,
    nullable: true,
  })
  awayScore?: number | null;

  @ApiProperty({
    description: 'Дата создания',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата обновления',
    example: '2024-06-16T00:00:00.000Z',
  })
  updatedAt: string;
}
