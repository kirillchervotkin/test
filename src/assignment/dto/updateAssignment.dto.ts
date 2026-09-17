import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateAssignmentDto {
  @ApiProperty({
    description: 'ID пользователя',
    example: 106,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiProperty({ description: 'ID роли на поле', example: 3, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  fieldRoleId?: number;
}
