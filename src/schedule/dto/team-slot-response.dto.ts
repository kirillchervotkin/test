import { ApiProperty } from '@nestjs/swagger';
import { CreateTeamSlotDto } from './create-team-slot.dto.js';
export class TeamSlotResponseDto extends CreateTeamSlotDto {
  @ApiProperty({ description: 'Идентификатор Uint64' })
  id!: string;
  @ApiProperty({ description: 'Дата создания' })
  createdAt!: string;
  @ApiProperty({ description: 'Дата изменения' })
  updatedAt!: string;
  @ApiProperty({ description: 'ID турнира' })
  tournamentId!: string;
}
