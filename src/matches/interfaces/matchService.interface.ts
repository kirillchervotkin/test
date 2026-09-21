import { CreateMatchDto } from '../dto/createMatch.dto.js';
import { MatchResponseDto } from '../dto/matchResponse.dto.js';
import { UpdateMatchDto } from '../dto/updateMatch.dto.js';

export interface MatchService {
  create(
    tournamentId: number,
    createMatchDto: CreateMatchDto,
    groupId?: number,
  ): MatchResponseDto;
  findAllByTournament(tournamentId: number): MatchResponseDto[];
  findAllByGroup(tournamentId: number, groupId: number): MatchResponseDto[];
  findOne(id: number): MatchResponseDto;
  update(id: number, updateMatchDto: UpdateMatchDto): MatchResponseDto;
  remove(id: number): { message: string };
  removeFromGroup(
    tournamentId: number,
    groupId: number,
    matchId: number,
  ): { message: string };
  removeFromTournament(
    tournamentId: number,
    matchId: number,
  ): { message: string };
}
