import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  Max,
  Min,
  Length,
  IsNumber,
} from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({
    description: 'Оценка (от 1 до 10)',
    example: 8.4,
    minimum: 1,
    maximum: 10,
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsNotEmpty()
  rating: number;

  @ApiProperty({
    description: 'Комментарий к оценке (необязательно)',
    example: 'Хорошая работа, но можно улучшить реакцию на игровые ситуации',
    required: false,
  })
  @IsOptional()
  @Length(0, 1000)
  comment?: string;
}
