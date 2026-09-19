import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateScheduleDto {
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
    required: false,
    nullable: true,
    description: 'Дата первого матча',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  firstMatchDate?: string;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Интервал между турами в днях',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4294967295)
  intervalDays?: number;
}
