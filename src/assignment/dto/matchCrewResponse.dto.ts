// src/assignments/dto/matchCrewResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { AssignmentWithDetailsResponseDto } from './assignmentWithDetailsResponse.dto.js';

/**
 * DTO ответа для «матч с бригадой».
 *
 * Используется в MatchCrewController: GET /matches/:id/crew.
 * Собирает всё, что нужно для отображения страницы матча,
 * одним запросом:
 *   - матч (дата, счёт, этап, город);
 *   - команды (названия);
 *   - бригада (ФИО судей, роли, порядок).
 *
 * Формат плоский: поля матча и массив crew на верхнем уровне.
 * Никаких вложенных `match: { ... }` — фронту так удобнее.
 */
export class MatchCrewResponseDto {
  @ApiProperty({
    description: 'ID матча',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  matchId: string;

  @ApiProperty({
    description: 'Дата и время матча',
    example: '2023-09-15T20:00:00.000Z',
  })
  matchDate: Date;

  @ApiProperty({
    description: 'Номер тура. null для матчей плей-офф',
    example: 5,
    nullable: true,
  })
  tourNumber: number | null;

  @ApiProperty({
    description: 'Голы хозяев. null, пока матч не сыгран',
    example: 2,
    nullable: true,
  })
  homeScore: number | null;

  @ApiProperty({
    description: 'Голы гостей. null, пока матч не сыгран',
    example: 1,
    nullable: true,
  })
  awayScore: number | null;

  @ApiProperty({
    description: 'ID домашней команды',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  homeTeamId: string | null;

  @ApiProperty({
    description: 'Название домашней команды',
    example: 'Зенит',
    nullable: true,
  })
  homeTeamName: string | null;

  @ApiProperty({
    description: 'ID гостевой команды',
    example: '550e8400-e29b-41d4-a716-446655440002',
    nullable: true,
  })
  awayTeamId: string | null;

  @ApiProperty({
    description: 'Название гостевой команды',
    example: 'ЦСКА',
    nullable: true,
  })
  awayTeamName: string | null;

  @ApiProperty({
    description: 'ID города',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  cityId: string;

  @ApiProperty({
    description: 'Название города',
    example: 'Москва',
  })
  cityName: string;

  @ApiProperty({
    description: 'ID этапа',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  stageId: string;

  @ApiProperty({
    description: 'Название этапа',
    example: 'Группа A',
  })
  stageName: string;

  @ApiProperty({
    description:
      'Бригада матча, отсортированная по порядку роли ' +
      '(Главный судья, Помощник, Резервный, VAR, AVAR). ' +
      'Пустой массив — валидное состояние: бригада может быть ' +
      'ещё не назначена.',
    type: [AssignmentWithDetailsResponseDto],
  })
  crew: AssignmentWithDetailsResponseDto[];
}
