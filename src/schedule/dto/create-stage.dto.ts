import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { Settings } from '../entities/types/schedule.types.js';

export class CreateStageDto {
  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'ID родительского этапа',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  parentStageId?: string | null;

  @ApiProperty({
    enum: ['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'],
    description: 'Тип',
  })
  @IsIn(['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'], {
    message: 'Недопустимое значение',
  })
  type!: 'STAGE' | 'GROUP' | 'ROUND' | 'PLAYOFF';

  @ApiProperty({
    enum: ['ROUND_ROBIN', 'SINGLE_ELIM', 'DOUBLE_ELIM'],
    description: 'Формат',
  })
  @IsIn(['ROUND_ROBIN', 'SINGLE_ELIM', 'DOUBLE_ELIM'], {
    message: 'Недопустимое значение',
  })
  format!: 'ROUND_ROBIN' | 'SINGLE_ELIM' | 'DOUBLE_ELIM';

  @ApiProperty({ description: 'Название' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Порядок сортировки' })
  @IsInt()
  @Min(0)
  @Max(4294967295)
  sortOrder!: number;

  @ApiProperty({
    required: false,
    nullable: true,
    type: Object,
    description: 'Настройки формата',
  })
  @IsOptional()
  @IsObject()
  settings?: Settings | null;
}
