// src/teams/dto/createTeam.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({
    description: 'Полное название команды',
    example: 'Зенит',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Короткое название для UI-таблиц (необязательно)',
    example: 'ЗЕН',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string | null;

  @ApiProperty({
    description:
      'ID домашнего города команды (необязательно). ' +
      'Может отсутствовать, например, для сборных.',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  cityId?: string | null;
}
