import { ApiProperty } from '@nestjs/swagger';
import { BracketSlotResponseDto } from './bracket-slot-response.dto.js';
import { MatchResponseDto } from './match-response.dto.js';
import { StageResponseDto } from './stage-response.dto.js';
import { TeamSlotResponseDto } from './team-slot-response.dto.js';
import { TournamentResponseDto } from './tournament-response.dto.js';
export class CalendarResponseDto {
  @ApiProperty({ type: TournamentResponseDto, description: 'Турнир' })
  tournament!: TournamentResponseDto;
  @ApiProperty({ type: [StageResponseDto], description: 'Этапы' })
  stages!: StageResponseDto[];
  @ApiProperty({ type: [TeamSlotResponseDto], description: 'Слоты' })
  slots!: TeamSlotResponseDto[];
  @ApiProperty({ type: [MatchResponseDto], description: 'Матчи' })
  matches!: MatchResponseDto[];
  @ApiProperty({ type: [BracketSlotResponseDto], description: 'Правила сетки' })
  bracketSlots!: BracketSlotResponseDto[];
}
export class StageTreeResponseDto extends StageResponseDto {
  @ApiProperty({
    type: () => [StageTreeResponseDto],
    description: 'Дочерние этапы',
  })
  children!: StageTreeResponseDto[];
}
