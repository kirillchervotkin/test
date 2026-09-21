// src/teams/dto/teamResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class TeamResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор команды',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Полное название команды',
    example: 'Зенит',
  })
  name: string;

  @ApiProperty({
    description: 'Короткое название для UI-таблиц',
    example: 'ЗЕН',
    nullable: true,
  })
  shortName: string | null;

  @ApiProperty({
    description: 'ID домашнего города команды',
    example: '550e8400-e29b-41d4-a716-446655440001',
    nullable: true,
  })
  cityId: string | null;
}
