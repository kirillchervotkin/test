import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class OverrideBracketSlotDto {
  @ApiProperty({ description: 'Назначенная команда' })
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  @Constraint({
    dbField: 'resolvedTeamId',
    messages: { foreignKey: 'validation.TEAM_NOT_FOUND' },
  })
  resolvedTeamId!: string;
}
