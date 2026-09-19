import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class OverrideBracketSlotDto {
  @ApiProperty({ description: 'Назначенная команда' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[1-9]\d{0,19}$/, { message: 'Ожидается строка Uint64' })
  resolvedTeamId!: string;
}
