// src/tournaments/tournament.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Tournament,
  CreateTournamentData,
  UpdateTournamentData,
  TournamentFilters,
} from './entities/types/tournament.types.js';
import { TournamentRepository } from './repository/tournament.repository.js';

@Injectable()
export class TournamentService {
  constructor(private readonly repository: TournamentRepository) {}

  async create(data: CreateTournamentData): Promise<Tournament> {
    return this.repository.create(data);
  }

  async findById(id: string): Promise<Tournament | null> {
    return this.repository.findById(id);
  }

  async findAll(params: {
    filter?: TournamentFilters;
    orderBy?: 'name' | 'season' | 'createdAt';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<Tournament[]> {
    return this.repository.findAll(
      params.filter,
      params.orderBy ?? 'season',
      params.orderDir ?? 'DESC',
    );
  }

  async update(data: UpdateTournamentData): Promise<Tournament> {
    const current = await this.repository.findById(data.id);
    if (!current) {
      throw new NotFoundException(`Tournament with id ${data.id} not found`);
    }

    const updated = await this.repository.updatePartial(data);
    if (!updated) {
      throw new NotFoundException(`Tournament with id ${data.id} not found`);
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Tournament with id ${id} not found`);
    }
  }
}
