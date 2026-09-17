import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min, IsOptional } from 'class-validator';

export class CreateMatchDto {
  @ApiProperty({
    description: 'Дата и время матча',
    example: '2024-06-15T18:00:00Z',
  })
  @IsDateString()
  matchDate: string;

  @ApiProperty({
    description: 'Место проведения матча',
    example: 'Санкт-Петербург',
  })
  @IsInt()
  @Min(1)
  cityId: number;

  @ApiProperty({
    description: 'ID команды хозяев',
    example: 1,
    type: Number,
  })
  @IsInt()
  @Min(1)
  homeTeamId: number;

  @ApiProperty({
    description: 'ID команды гостей',
    example: 2,
    type: Number,
  })
  @IsInt()
  @Min(1)
  awayTeamId: number;

  @ApiProperty({
    description: 'Счет хозяев (необязательно)',
    example: 2,
    required: false,
    type: Number,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  homeScore?: number;

  @ApiProperty({
    description: 'Счет гостей (необязательно)',
    example: 1,
    required: false,
    type: Number,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  awayScore?: number;
}
