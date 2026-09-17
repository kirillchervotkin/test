import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ example: 1, description: 'Уникальный идентификатор роли' })
  id: number;

  @ApiProperty({ example: 'Администратор', description: 'Название роли' })
  name: string;

  @ApiProperty({
    example: '2022-01-01T00:00:00.000Z',
    description: 'Дата создания роли',
  })
  createdAt: string;

  @ApiProperty({
    example: '2022-01-01T00:00:00.000Z',
    description: 'Дата последнего обновления роли',
  })
  updatedAt: string;
}
