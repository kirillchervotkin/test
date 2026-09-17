import { ApiProperty } from '@nestjs/swagger';

export class UserWithoutExcludedDto {
  @ApiProperty({
    description: 'Уникальный идентификатор пользователя (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Имя пользователя',
    example: 'Иван',
  })
  firstName: string;

  @ApiProperty({
    description: 'Фамилия пользователя',
    example: 'Иванов',
  })
  lastName: string;

  @ApiProperty({
    description: 'Email адрес пользователя',
    example: 'user@example.com',
    nullable: true,
    required: false,
  })
  email: string | null;

  @ApiProperty({
    description: 'Дата рождения пользователя в формате YYYY-MM-DD',
    example: '1990-01-01',
    nullable: true,
    required: false,
  })
  birthDate: string | null;

  @ApiProperty({
    description: 'Статус активности пользователя',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Дата создания пользователя (ISO 8601)',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Дата последнего обновления пользователя (ISO 8601)',
    example: '2023-01-02T00:00:00.000Z',
  })
  updatedAt: Date;
}
