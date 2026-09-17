import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class UnassignListParamsDto {
  @IsUUID()
  @Constraint({
    dbField: 'user_id',
  })
  userId: string;

  @IsUUID()
  @Constraint({
    dbField: 'list_id',
  })
  listId: string;
}
