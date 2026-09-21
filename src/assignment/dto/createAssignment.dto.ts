// src/assignments/dto/createAssignment.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * DTO создания назначения.
 *
 * `matchId` НЕ передаётся клиентом — он берётся из path-параметра
 * маршрута (`POST /matches/:matchId/assignments`) и подставляется
 * в маппере отдельным аргументом. Так клиент не может создать
 * назначение не тому матчу, для которого открыт редактор бригады.
 *
 * `userId` и `fieldRoleId` — обязательные. Все три ссылки
 * проверяются в репозитории внутри транзакции:
 *   1. Матч существует.
 *   2. Судья существует.
 *   3. Роль существует.
 *   4. Судья не назначен на этот матч дважды.
 *   5. Судья не назначен на другой матч в тот же день.
 */
export class CreateAssignmentDto {
  @ApiProperty({
    description: 'ID судьи (пользователя)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'ID роли на поле',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  fieldRoleId: string;
}
