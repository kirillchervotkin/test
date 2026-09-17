import { ApiProperty } from '@nestjs/swagger';
import { RoleResponseDto } from '../../role/dto/roleResponse.dto.js';

export class ListRoleResponseDto {
  @ApiProperty({
    description: 'ID связи списка и роли',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'ID списка',
    example: 1,
  })
  listId: number;

  @ApiProperty({
    description: 'ID роли',
    example: 1,
  })
  roleId: number;

  @ApiProperty({
    description: 'Дата создания',
    example: '2022-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата обновления',
    example: '2022-01-01T00:00:00.000Z',
  })
  updatedAt: string;

  @ApiProperty({
    description: 'Информация о роли',
    type: RoleResponseDto,
  })
  role?: RoleResponseDto;
}
