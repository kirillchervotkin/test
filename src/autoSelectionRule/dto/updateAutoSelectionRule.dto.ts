import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional } from 'class-validator';

export class UpdateAutoSelectionRuleDto {
  @ApiProperty({
    description: 'ID списка',
    example: 42,
    required: false,
  })
  @IsNumber()
  @IsPositive()
  @IsOptional()
  listId?: number;
}
