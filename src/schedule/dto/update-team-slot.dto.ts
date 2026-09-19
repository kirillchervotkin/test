import { Constraint } from '../../common/decorators/unique.decorator.js';
import { PartialType } from '@nestjs/swagger';
import { CreateTeamSlotDto } from './create-team-slot.dto.js';
export class UpdateTeamSlotDto extends PartialType(CreateTeamSlotDto, {
  skipNullProperties: false,
}) {
  @Constraint({
    dbField: 'teamId',
    messages: { foreignKey: 'validation.TEAM_NOT_FOUND' },
  })
  teamId?: string | null;
}
