import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class UserIdParamDto {
  @IsUUID()
  @Constraint({
    dbField: 'user_id',
  })
  userId: string;
}
