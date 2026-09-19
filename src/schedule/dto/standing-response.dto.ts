import { ApiProperty } from '@nestjs/swagger';
export class StandingResponseDto {
  @ApiProperty({ description: 'ID команды' }) teamId!: string;
  @ApiProperty({ description: 'Место' }) position!: number;
  @ApiProperty({ description: 'Матчи' }) played!: number;
  @ApiProperty({ description: 'Победы' }) wins!: number;
  @ApiProperty({ description: 'Ничьи' }) draws!: number;
  @ApiProperty({ description: 'Поражения' }) losses!: number;
  @ApiProperty({ description: 'Забито' }) goalsFor!: number;
  @ApiProperty({ description: 'Пропущено' }) goalsAgainst!: number;
  @ApiProperty({ description: 'Разница голов' }) goalDifference!: number;
  @ApiProperty({ description: 'Очки' }) points!: number;
  @ApiProperty({ description: 'Равенство всех критериев' }) tied!: boolean;
}
