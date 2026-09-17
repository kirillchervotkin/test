import { ApiProperty } from '@nestjs/swagger';

export class FieldRoleResponseDto {
  @ApiProperty({
    description: 'ID роли',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Название роли',
    example: 'Главный судья',
  })
  name: string;

  @ApiProperty({
    description: 'Дата создания',
    example: '2022-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата последнего обновления',
    example: '2022-01-01T00:00:00.000Z',
  })
  updatedAt: string;
}
