import { ApiProperty } from '@nestjs/swagger';
import { CreateTournamentDto } from './create-tournament.dto.js';
export class TournamentResponseDto extends CreateTournamentDto {
  @ApiProperty({ description: 'Идентификатор Uint64' })
  id!: string;
  @ApiProperty({ description: 'Дата создания' })
  createdAt!: string;
  @ApiProperty({ description: 'Дата изменения' })
  updatedAt!: string;
}
