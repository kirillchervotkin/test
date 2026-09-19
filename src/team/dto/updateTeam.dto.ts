import { PartialType } from '@nestjs/swagger';
import { CreateTeamDto } from './createTeam.dto.js';
import { Constraint } from '../../common/decorators/unique.decorator.js';
export class UpdateTeamDto extends PartialType(CreateTeamDto) {
  @Constraint({
    dbField: 'name',
    messages: { uniqueComposite: 'validation.UNIQUE_TEAM_CITY' },
  })
  name?: string;
  @Constraint({
    dbField: 'cityId',
    messages: {
      foreignKey: 'validation.CITY_NOT_FOUND',
      uniqueComposite: 'validation.UNIQUE_TEAM_CITY',
    },
  })
  cityId?: string;
}
