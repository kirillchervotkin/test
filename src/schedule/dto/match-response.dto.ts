import { ApiProperty } from '@nestjs/swagger';
import { CreateMatchDto } from './create-match.dto.js';
export class MatchResponseDto extends CreateMatchDto {
  @ApiProperty({ description: 'Идентификатор Uint64' })
  id!: string;
  @ApiProperty({ description: 'Дата создания' })
  createdAt!: string;
  @ApiProperty({ description: 'Дата изменения' })
  updatedAt!: string;
  @ApiProperty({ description: 'ID турнира' })
  tournamentId!: string;
}
