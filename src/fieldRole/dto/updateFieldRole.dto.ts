// src/field-roles/dto/updateFieldRole.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, IsOptional, MaxLength } from 'class-validator';

/**
 * `id` здесь отсутствует намеренно: он берётся из path-параметра
 * маршрута (`PATCH /field-roles/:id`) и передаётся в маппер
 * отдельным аргументом.
 *
 * `null` не допускается: у роли нет nullable-полей. Только
 * `undefined` (не трогать) или значение (заменить).
 *
 * `code` можно менять, но осторожно: он используется в
 * бизнес-логике и как ключ локализации.
 */
export class UpdateFieldRoleDto {
  @ApiProperty({
    description: 'Новый программный код роли (необязательно)',
    required: false,
    example: 'REFEREE',
    enum: ['REFEREE', 'ASSISTANT', 'RESERVE', 'VAR', 'AVAR'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiProperty({
    description: 'Новое отображаемое имя (необязательно)',
    required: false,
    example: 'Главный судья',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: 'Новый порядок отображения (необязательно)',
    required: false,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  sortOrder?: number;
}
