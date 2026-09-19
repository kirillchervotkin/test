import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AssignTeamSlotDto {
  @ApiProperty({ description: 'ID команды' })
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  @Constraint({
    dbField: 'teamId',
    messages: { foreignKey: 'validation.TEAM_NOT_FOUND' },
  })
  teamId!: string;
}
