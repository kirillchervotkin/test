// src/assignments/dto/assignmentResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO ответа для назначения (базовый, без деталей).
 *
 * Используется в CRUD-контроллере: `GET /matches/:matchId/assignments`,
 * `PATCH /assignments/:id` и т.д.
 *
 * Для отображения с ФИО судьи и названием роли используется
 * `AssignmentWithDetailsResponseDto` (в MatchCrewController).
 */
export class AssignmentResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор назначения',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'ID матча',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  matchId: string;

  @ApiProperty({
    description: 'ID судьи (пользователя)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  userId: string;

  @ApiProperty({
    description: 'ID роли на поле',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  fieldRoleId: string;
}
