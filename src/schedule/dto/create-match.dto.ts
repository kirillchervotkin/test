import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';
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
  @IsUUID('4')
  @Constraint({
    dbField: 'cityId',
    messages: { foreignKey: 'validation.CITY_NOT_FOUND' },
  })
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
  @IsUUID('4')
  @Constraint({
    dbField: 'homeTeamId',
    messages: { foreignKey: 'validation.TEAM_NOT_FOUND' },
  })
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
  @IsUUID('4')
  @Constraint({
    dbField: 'awayTeamId',
    messages: { foreignKey: 'validation.TEAM_NOT_FOUND' },
  })
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
