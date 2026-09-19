import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class TournamentFilterDto {
  @ApiProperty({ required: false, nullable: true, description: 'Сезон' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  season?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: ['LEAGUE', 'CUP', 'SUPER_CUP'],
    description: 'Тип',
  })
  @IsOptional()
  @IsIn(['LEAGUE', 'CUP', 'SUPER_CUP'], { message: 'Недопустимое значение' })
  type?: 'LEAGUE' | 'CUP' | 'SUPER_CUP';

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Начало диапазона',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Конец диапазона',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;
}
