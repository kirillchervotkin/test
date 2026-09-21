// src/field-roles/dto/createFieldRole.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, Min, MaxLength } from 'class-validator';

/**
 * Все поля обязательны. У роли нет nullable-полей и опциональных
 * значений — код, имя и порядок нужны всегда.
 */
export class CreateFieldRoleDto {
  @ApiProperty({
    description:
      'Программный код роли. Используется в бизнес-логике и как ' +
      'ключ для локализации на фронте.',
    example: 'REFEREE',
    enum: ['REFEREE', 'ASSISTANT', 'RESERVE', 'VAR', 'AVAR'],
  })
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty({
    description: 'Отображаемое имя на русском (fallback для UI)',
    example: 'Главный судья',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Порядок отображения в UI (1 — первый)',
    example: 1,
  })
  @IsInt()
  @Min(1)
  sortOrder: number;
}
