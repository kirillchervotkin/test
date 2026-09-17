import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
} from 'class-validator';

export class UpdateMatchDto {
  @ApiProperty({
    description: 'Дата и время матча',
    example: '2024-06-15T20:00:00Z',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  matchDate?: string;

  @ApiProperty({
    description: 'Место проведения матча',
    example: 'Камп Ноу',
    required: false,
  })
  @IsString()
  @IsOptional()
  venue?: string;

  @ApiProperty({
    description: 'ID команды хозяев',
    example: 2,
    type: Number,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  homeTeamId?: number;

  @ApiProperty({
    description: 'ID команды гостей',
    example: 3,
    type: Number,
    required: false,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  awayTeamId?: number;

  @ApiProperty({
    description: 'ID группы (необязательно)',
    example: 1,
    required: false,
    nullable: true,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  groupId?: number | null;

  @ApiProperty({
    description: 'Счет хозяев',
    example: 3,
    required: false,
    nullable: true,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  homeScore?: number | null;

  @ApiProperty({
    description: 'Счет гостей',
    example: 2,
    required: false,
    nullable: true,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  awayScore?: number | null;
}
