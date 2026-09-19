import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ResolveBracketDto {
  @ApiProperty({ required: false, nullable: true, description: 'ID этапа' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  stageId?: string;
}
