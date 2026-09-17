import { Injectable } from '@nestjs/common';
import { TournamentResponseDto } from './dto/tournamentResponse.dto.js';
import { CreateTournamentDto } from './dto/createTournament.dto.js';
import { UpdateTournamentDto } from './dto/updateTournament.dto.js';
import { TournamentStatus } from './dto/createTournament.dto.js';
import { TournamentsService } from './interfaces/tournamentService.interface.js';
import { EntityNotFoundException } from '../common/exceptions/entityNotFound.exception.js';

interface TournamentStub {
  id: number;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  status: TournamentStatus;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TypeOrmTournamentsService implements TournamentsService {
  private tournaments: TournamentStub[] = [];
  private nextId = 1;

  findAll(): Promise<TournamentResponseDto[]> {
    const result = [...this.tournaments]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((tournament) => this.mapToResponseDto(tournament));

    return Promise.resolve(result);
  }

  findById(id: number): Promise<TournamentResponseDto> {
    const tournament = this.tournaments.find((t) => t.id === id);

    if (!tournament) {
      return Promise.reject(new EntityNotFoundException('Tournament', id));
    }

    return Promise.resolve(this.mapToResponseDto(tournament));
  }

  create(
    createTournamentDto: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    const now = new Date();

    const tournament: TournamentStub = {
      id: this.nextId++,
      name: createTournamentDto.name,
      description: createTournamentDto.description,
      startDate: new Date(createTournamentDto.startDate),
      endDate: new Date(createTournamentDto.endDate),
      status: createTournamentDto.status || TournamentStatus.PLANNED,
      createdAt: now,
      updatedAt: now,
    };

    this.tournaments.push(tournament);
    return Promise.resolve(this.mapToResponseDto(tournament));
  }

  update(
    id: number,
    updateTournamentDto: UpdateTournamentDto,
  ): Promise<TournamentResponseDto> {
    const tournament = this.tournaments.find((t) => t.id === id);

    if (!tournament) {
      return Promise.reject(new EntityNotFoundException('Tournament', id));
    }

    if (updateTournamentDto.name !== undefined) {
      tournament.name = updateTournamentDto.name;
    }
    if (updateTournamentDto.description !== undefined) {
      tournament.description = updateTournamentDto.description;
    }
    if (updateTournamentDto.startDate !== undefined) {
      tournament.startDate = new Date(updateTournamentDto.startDate);
    }
    if (updateTournamentDto.endDate !== undefined) {
      tournament.endDate = new Date(updateTournamentDto.endDate);
    }
    if (updateTournamentDto.status !== undefined) {
      tournament.status = updateTournamentDto.status;
    }

    tournament.updatedAt = new Date();

    return Promise.resolve(this.mapToResponseDto(tournament));
  }

  remove(id: number): Promise<void> {
    const index = this.tournaments.findIndex((t) => t.id === id);

    if (index === -1) {
      return Promise.reject(new EntityNotFoundException('Tournament', id));
    }

    this.tournaments.splice(index, 1);
    return Promise.resolve();
  }

  isExistOrFail(id: number): Promise<void> {
    const exists = this.tournaments.some((t) => t.id === id);

    if (!exists) {
      return Promise.reject(new EntityNotFoundException('Tournament', id));
    }

    return Promise.resolve();
  }

  private mapToResponseDto(tournament: TournamentStub): TournamentResponseDto {
    return {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      startDate: this.formatDate(tournament.startDate),
      endDate: this.formatDate(tournament.endDate),
      status: tournament.status,
      createdAt: tournament.createdAt.toISOString(),
      updatedAt: tournament.updatedAt.toISOString(),
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
