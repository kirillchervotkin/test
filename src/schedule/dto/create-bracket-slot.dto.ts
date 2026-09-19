import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateBracketSlotDto {
  @ApiProperty({ description: 'ID матча' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  matchId!: string;

  @ApiProperty({ enum: ['HOME', 'AWAY'], description: 'Сторона матча' })
  @IsIn(['HOME', 'AWAY'], { message: 'Недопустимое значение' })
  side!: 'HOME' | 'AWAY';

  @ApiProperty({
    enum: ['GROUP', 'WINNER', 'LOSER'],
    description: 'Тип источника команды',
  })
  @IsIn(['GROUP', 'WINNER', 'LOSER'], { message: 'Недопустимое значение' })
  sourceType!: 'GROUP' | 'WINNER' | 'LOSER';

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'ID исходного этапа',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  sourceStageId?: string | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Название исходной группы',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceGroupName?: string | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Место в исходной группе',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4294967295)
  sourcePosition?: number | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'ID исходного матча',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  sourceMatchId?: string | null;
}
