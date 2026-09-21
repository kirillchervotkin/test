// src/assignments/dto/updateAssignment.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

/**
 * DTO частичного обновления назначения.
 *
 * `id` здесь отсутствует намеренно: он берётся из path-параметра
 * маршрута (`PATCH /assignments/:id`) и передаётся в маппер
 * отдельным аргументом.
 *
 * `matchId` НЕ меняется: перенос назначения на другой матч —
 * это delete + create. Семантически назначение привязано к матчу.
 *
 * Все поля опциональны. `null` не допускается: у назначения нет
 * nullable-полей.
 *
 * При смене `userId` репозиторий повторно проверяет нового судью:
 * существует, не назначен на этот матч дважды, не назначен на
 * другой матч в тот же день.
 *
 * При смене `fieldRoleId` — проверяет, что новая роль существует.
 */
export class UpdateAssignmentDto {
  @ApiProperty({
    description: 'Новый ID судьи (необязательно)',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: 'Новый ID роли на поле (необязательно)',
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  fieldRoleId?: string;
}
