import { CreateTournamentDto } from '../dto/createTournament.dto.js';
import { TournamentResponseDto } from '../dto/tournamentResponse.dto.js';
import { UpdateTournamentDto } from '../dto/updateTournament.dto.js';

export interface TournamentsService {
  findAll(): Promise<TournamentResponseDto[]>;
  findById(id: number): Promise<TournamentResponseDto>;
  create(
    createTournamentDto: CreateTournamentDto,
  ): Promise<TournamentResponseDto>;
  update(
    id: number,
    updateTournamentDto: UpdateTournamentDto,
  ): Promise<TournamentResponseDto>;
  remove(id: number): Promise<void>;
  isExistOrFail(id: number): Promise<void>;
}
