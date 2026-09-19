import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreateTournamentDto {
  @ApiProperty({ description: 'Название' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Сезон' })
  @IsString()
  @IsNotEmpty()
  season!: string;

  @ApiProperty({ enum: ['LEAGUE', 'CUP', 'SUPER_CUP'], description: 'Тип' })
  @IsIn(['LEAGUE', 'CUP', 'SUPER_CUP'], { message: 'Недопустимое значение' })
  type!: 'LEAGUE' | 'CUP' | 'SUPER_CUP';

  @ApiProperty({ description: 'Дата начала' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @ApiProperty({ description: 'Дата окончания' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'ID шаблона',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  templateId?: string | null;
}
