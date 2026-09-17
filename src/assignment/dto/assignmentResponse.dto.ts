import { ApiProperty } from '@nestjs/swagger';

export class AssignmentResponseDto {
  @ApiProperty({ description: 'ID назначения', example: 1 })
  id: number;

  @ApiProperty({ description: 'ID матча', example: 1 })
  matchId: number;

  @ApiProperty({ description: 'ID пользователя', example: 1 })
  userId: number;

  @ApiProperty({
    description: 'ID роли на поле',
    example: 1,
  })
  fieldRoleId: number;

  @ApiProperty({
    description: 'Дата создания назначения',
    example: '2023-09-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата обновления назначения',
    example: '2023-09-01T00:00:00.000Z',
  })
  updatedAt: string;
}
