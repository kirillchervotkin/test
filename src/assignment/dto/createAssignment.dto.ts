import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({
    description: 'ID пользователя (судьи)',
    example: 1,
  })
  @IsNumber()
  userId: number;

  @ApiProperty({
    description: 'ID роли на поле',
    example: 1,
  })
  @IsNumber()
  fieldRoleId: number;
}
