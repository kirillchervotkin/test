// src/matches/dto/updateMatch.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsOptional, IsInt, Min } from 'class-validator';

/**
 * `id` здесь отсутствует намеренно: он берётся из path-параметра
 * маршрута (`PATCH /matches/:id`) и передаётся в маппер отдельно.
 *
 * `tournamentId` и `stageId` не меняются: перенос матча между
 * турнирами/этапами — это delete + create.
 *
 * Проверки, которые уезжают в сервис:
 *   1. `tourNumber` ↔ `stage.format` — DTO не видит этапа.
 *   2. «Команды не совпадают» после частичного слияния — DTO
 *      видит только патч, а не итоговое состояние матча.
 *
 * Семантика `undefined` vs `null`:
 *   - `undefined` — поле не передано, не трогаем в БД.
 *   - `null` — явное «обнулить». Для `homeTeamId`/`awayTeamId` —
 *     снять команду; для `homeScore`/`awayScore` — сбросить счёт;
 *     для `tourNumber` — снять номер тура.
 */
export class UpdateMatchDto {
  @ApiProperty({
    description: 'Новая дата и время матча (необязательно)',
    required: false,
    example: '2023-09-15T20:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  matchDate?: string;

  @ApiProperty({
    description: 'Новый ID города (необязательно)',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  cityId?: string;

  @ApiProperty({
    description:
      'Новый номер тура. Чтобы снять значение, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  tourNumber?: number | null;

  @ApiProperty({
    description:
      'Новый ID домашней команды. Чтобы снять, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  homeTeamId?: string | null;

  @ApiProperty({
    description:
      'Новый ID гостевой команды. Чтобы снять, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  awayTeamId?: string | null;

  @ApiProperty({
    description:
      'Голы хозяев. Чтобы сбросить счёт, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number | null;

  @ApiProperty({
    description:
      'Голы гостей. Чтобы сбросить счёт, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number | null;
}
