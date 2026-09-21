// src/matches/dto/matchResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class MatchResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор матча',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID турнира',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  tournamentId: string;

  @ApiProperty({
    description: 'ID этапа',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  stageId: string;

  @ApiProperty({
    description: 'Номер тура. null для матчей плей-офф (ELIMINATION).',
    example: 5,
    nullable: true,
  })
  tourNumber: number | null;

  @ApiProperty({
    description: 'Дата и время матча',
    example: '2023-09-15T20:00:00.000Z',
  })
  matchDate: Date;

  @ApiProperty({
    description: 'ID города',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  cityId: string;

  @ApiProperty({
    description:
      'ID домашней команды. null, пока участник плей-офф не определён.',
    example: '550e8400-e29b-41d4-a716-446655440004',
    nullable: true,
  })
  homeTeamId: string | null;

  @ApiProperty({
    description:
      'ID гостевой команды. null, пока участник плей-офф не определён.',
    example: '550e8400-e29b-41d4-a716-446655440005',
    nullable: true,
  })
  awayTeamId: string | null;

  @ApiProperty({
    description: 'Голы хозяев. null, пока матч не сыгран.',
    example: 2,
    nullable: true,
  })
  homeScore: number | null;

  @ApiProperty({
    description: 'Голы гостей. null, пока матч не сыгран.',
    example: 1,
    nullable: true,
  })
  awayScore: number | null;
}
