import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty } from 'class-validator';

export class CreateListRoleDto {
  @ApiProperty({
    description: 'ID роли для добавления к списку',
    example: 1,
  })
  @IsNumber()
  @IsNotEmpty()
  roleId: number;
}
