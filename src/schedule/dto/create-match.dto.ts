import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateMatchDto {
  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'ID этапа',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  stageId?: string | null;

  @ApiProperty({ description: 'Дата и время матча' })
  @IsISO8601({ strict: true })
  matchDate!: string;

  @ApiProperty({ description: 'ID города' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  cityId!: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Слот хозяев',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  homeSlotId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Слот гостей',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  awaySlotId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Команда хозяев',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  homeTeamId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Команда гостей',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  awayTeamId?: string | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Голы хозяев',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  homeScore?: number | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Голы гостей',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  awayScore?: number | null;
}
