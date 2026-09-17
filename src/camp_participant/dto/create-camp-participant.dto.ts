// src/camp-participant/dto/create-camp-participant.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCampParticipantDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'UUID пользователя для добавления в лагерь',
  })
  @IsUUID()
  userId: string;
}
