// src/assignments/dto/assignmentWithDetailsResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO ответа для назначения с деталями.
 *
 * Используется в MatchCrewController: `GET /matches/:id/crew`.
 * Отдаёт ФИО судьи и данные роли, чтобы фронт мог отобразить
 * бригаду без дополнительных запросов.
 *
 * Сортировка — по `roleSortOrder` (Главный судья первый).
 */
export class AssignmentWithDetailsResponseDto {
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
    description: 'ID судьи',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  userId: string;

  @ApiProperty({
    description: 'Имя судьи',
    example: 'Иван',
  })
  userFirstName: string;

  @ApiProperty({
    description: 'Фамилия судьи',
    example: 'Петров',
  })
  userLastName: string;

  @ApiProperty({
    description: 'ID роли на поле',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  fieldRoleId: string;

  @ApiProperty({
    description: 'Программный код роли (для локализации на фронте)',
    example: 'REFEREE',
  })
  roleCode: string;

  @ApiProperty({
    description: 'Название роли на русском (fallback)',
    example: 'Главный судья',
  })
  roleName: string;

  @ApiProperty({
    description: 'Порядок отображения роли в UI',
    example: 1,
  })
  roleSortOrder: number;
}
