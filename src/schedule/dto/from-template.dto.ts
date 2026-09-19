import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsString, Matches } from 'class-validator';

export class FromTemplateDto {
  @ApiProperty({ description: 'ID шаблона' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  templateId!: string;

  @ApiProperty({ description: 'Сезон' })
  @IsString()
  @IsNotEmpty()
  season!: string;

  @ApiProperty({ description: 'Дата начала' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @ApiProperty({ description: 'Дата окончания' })
  @IsISO8601({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;
}
