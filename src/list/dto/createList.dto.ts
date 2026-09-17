import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class CreateListDto {
  @ApiProperty({
    description: 'Название списка',
    example: 'Вторая лига',
  })
  @IsString()
  @Constraint({ dbField: 'email' })
  name: string;

  @ApiPropertyOptional({
    description: 'ID пользователя входящего в список',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  userId?: number;
}
