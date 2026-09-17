import { ApiProperty } from '@nestjs/swagger';

export class AutoSelectionRuleResponseDto {
  @ApiProperty({
    description: 'ID правила',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'ID турнира',
    example: 5,
  })
  tournamentId: number;

  @ApiProperty({
    description: 'ID роли',
    example: 10,
  })
  fieldRoleId: number;

  @ApiProperty({
    description: 'ID списка',
    example: 42,
  })
  listId: number;

  @ApiProperty({
    description: 'Дата создания',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата обновления',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt: string;
}
