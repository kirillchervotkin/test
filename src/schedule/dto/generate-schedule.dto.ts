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

export class GenerateScheduleDto {
  @ApiProperty({ description: 'ID города' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
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
