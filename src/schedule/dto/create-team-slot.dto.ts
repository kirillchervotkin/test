import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateTeamSlotDto {
  @ApiProperty({ description: 'ID этапа' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  stageId!: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'Название группы',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  groupName?: string | null;

  @ApiProperty({ description: 'Название слота' })
  @IsString()
  @IsNotEmpty()
  slotName!: string;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    description: 'ID команды',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  teamId?: string | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Номер посева',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4294967295)
  seed?: number | null;
}
