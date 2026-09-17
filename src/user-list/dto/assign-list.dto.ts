import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class AssignListDto {
  @ApiProperty({
    description: 'ID списка для привязки к пользователю',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @Constraint({
    dbField: 'list_id',
    messages: {
      uniqueComposite: 'validation.USER_LIST_ALREADY_EXISTS',
    },
  })
  listId: string;
}
