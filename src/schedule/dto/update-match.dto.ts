import { Constraint } from '../../common/decorators/unique.decorator.js';
import { PartialType } from '@nestjs/swagger';
import { CreateMatchDto } from './create-match.dto.js';
export class UpdateMatchDto extends PartialType(CreateMatchDto, {
  skipNullProperties: false,
}) {
  @Constraint({
    dbField: 'cityId',
    messages: { foreignKey: 'validation.CITY_NOT_FOUND' },
  })
  cityId?: string;
  @Constraint({
    dbField: 'homeTeamId',
    messages: { foreignKey: 'validation.TEAM_NOT_FOUND' },
  })
  homeTeamId?: string | null;
  @Constraint({
    dbField: 'awayTeamId',
    messages: { foreignKey: 'validation.TEAM_NOT_FOUND' },
  })
  awayTeamId?: string | null;
}
