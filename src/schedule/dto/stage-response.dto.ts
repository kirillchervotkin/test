import { ApiProperty } from '@nestjs/swagger';
import { CreateStageDto } from './create-stage.dto.js';
export class StageResponseDto extends CreateStageDto {
  @ApiProperty({ description: 'Идентификатор Uint64' })
  id!: string;
  @ApiProperty({ description: 'Дата создания' })
  createdAt!: string;
  @ApiProperty({ description: 'Дата изменения' })
  updatedAt!: string;
  @ApiProperty({ description: 'ID турнира' })
  tournamentId!: string;
}
