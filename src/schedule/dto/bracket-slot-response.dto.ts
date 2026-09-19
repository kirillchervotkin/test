import { ApiProperty } from '@nestjs/swagger';
import { CreateBracketSlotDto } from './create-bracket-slot.dto.js';
export class BracketSlotResponseDto extends CreateBracketSlotDto {
  @ApiProperty({ description: 'Идентификатор Uint64' })
  id!: string;
  @ApiProperty({ description: 'Дата создания' })
  createdAt!: string;
  @ApiProperty({ description: 'Дата изменения' })
  updatedAt!: string;
  @ApiProperty({ description: 'Назначенная команда' })
  resolvedTeamId!: string | null;
}
