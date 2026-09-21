// src/tournaments/mappers/tournament.mapper.ts

import { CreateTournamentDto } from '../dto/createTournament.dto.js';
import { UpdateTournamentDto } from '../dto/updateTournament.dto.js';
import { TournamentResponseDto } from '../dto/tournamentResponse.dto.js';
import {
  Tournament,
  CreateTournamentData,
  UpdateTournamentData,
} from '../entities/types/tournament.types.js';

export class TournamentMapper {
  // ============================================================
  // DTO → DATA
  // ============================================================

  static toCreateData(dto: CreateTournamentDto): CreateTournamentData {
    const data: CreateTournamentData = {
      name: dto.name,
      season: dto.season,
      type: dto.type,
    };

    if (dto.startDate != null) {
      data.startDate = new Date(dto.startDate);
    }
    if (dto.endDate != null) {
      data.endDate = new Date(dto.endDate);
    }

    return data;
  }

  static toUpdateData(
    id: string,
    dto: UpdateTournamentDto,
  ): UpdateTournamentData {
    const data: UpdateTournamentData = { id };

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.season !== undefined) data.season = dto.season;
    if (dto.type !== undefined) data.type = dto.type;

    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate === null ? null : new Date(dto.startDate);
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate === null ? null : new Date(dto.endDate);
    }

    return data;
  }

  // ============================================================
  // ENTITY → DTO
  // ============================================================

  static toDto(entity: Tournament): TournamentResponseDto {
    return {
      id: entity.id,
      name: entity.name,
      season: entity.season,
      type: entity.type,
      startDate: entity.startDate,
      endDate: entity.endDate,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toDtoList(entities: Tournament[]): TournamentResponseDto[] {
    return entities.map((e) => this.toDto(e));
  }
}
