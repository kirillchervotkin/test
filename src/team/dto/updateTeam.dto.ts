// src/teams/dto/updateTeam.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

/**
 * `id` здесь отсутствует намеренно: он берётся из path-параметра
 * маршрута (`PATCH /teams/:id`) и передаётся в маппер отдельным
 * аргументом.
 *
 * Семантика `undefined` vs `null`:
 *   - `undefined` — поле не передано, не трогаем в БД.
 *   - `null` — явное «обнулить». Для `shortName` — убрать короткое
 *     имя; для `cityId` — убрать домашний город.
 */
export class UpdateTeamDto {
  @ApiProperty({
    description: 'Новое название команды (необязательно)',
    required: false,
    example: 'Зенит',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description:
      'Новое короткое название. Чтобы убрать, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: 'ЗЕН',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string | null;

  @ApiProperty({
    description:
      'Новый ID домашнего города. Чтобы убрать, передайте null (необязательно).',
    required: false,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  cityId?: string | null;
}
