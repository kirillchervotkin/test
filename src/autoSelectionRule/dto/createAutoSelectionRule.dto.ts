import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class CreateAutoSelectionRuleDto {
  @ApiProperty({
    description: 'ID роли',
    example: 10,
  })
  @IsNumber()
  @IsPositive()
  fieldRoleId: number;

  @ApiProperty({
    description: 'ID списка',
    example: 42,
  })
  @IsNumber()
  @IsPositive()
  listId: number;
}
