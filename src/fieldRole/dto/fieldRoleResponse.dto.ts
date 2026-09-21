// src/field-roles/dto/fieldRoleResponse.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class FieldRoleResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор роли',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Программный код роли',
    example: 'REFEREE',
  })
  code: string;

  @ApiProperty({
    description: 'Отображаемое имя на русском',
    example: 'Главный судья',
  })
  name: string;

  @ApiProperty({
    description: 'Порядок отображения в UI',
    example: 1,
  })
  sortOrder: number;
}
