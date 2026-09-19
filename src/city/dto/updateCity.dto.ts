import { PartialType } from '@nestjs/swagger';
import { CreateCityDto } from './createCity.dto.js';
import { Constraint } from '../../common/decorators/unique.decorator.js';
export class UpdateCityDto extends PartialType(CreateCityDto) {
  @Constraint({
    dbField: 'name',
    messages: { unique: 'validation.UNIQUE_CITY' },
  })
  name?: string;
}
