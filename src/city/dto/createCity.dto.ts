import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';
import { vMsg } from '../../common/utils/validation-message.js';

export class CreateCityDto {
  @Constraint({
    messages: {
      unique: 'validation.UNIQUE_CITY',
    },
  })
  @IsString({ message: vMsg('validation.IS_STRING') })
  @IsNotEmpty({ message: vMsg('validation.NOT_EMPTY') })
  @MaxLength(100, { message: vMsg('validation.MAX_LENGTH') })
  name: string;
}
