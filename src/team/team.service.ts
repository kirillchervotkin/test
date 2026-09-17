import { Injectable } from '@nestjs/common';
import { TeamResponseDto } from './dto/teamResponse.dto.js';
import { CreateTeamDto } from './dto/createTeam.dto.js';
import { UpdateTeamDto } from './dto/updateTeam.dto.js';
import { TeamService } from './interfaces/teamService.interface.js';
import { EntityNotFoundException } from '../common/exceptions/entityNotFound.exception.js';

interface TeamStub {
  id: number;
  name: string;
  cityId: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TypeOrmTeamService implements TeamService {
  private teams: TeamStub[] = [];
  private nextId = 1;

  create(createTeamDto: CreateTeamDto): Promise<TeamResponseDto> {
    const now = new Date();

    const team: TeamStub = {
      id: this.nextId++,
      name: createTeamDto.name,
      cityId: createTeamDto.cityId,
      createdAt: now,
      updatedAt: now,
    };

    this.teams.push(team);
    return Promise.resolve(this.mapToResponseDto(team));
  }

  findAll(): Promise<TeamResponseDto[]> {
    const result = [...this.teams]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((team) => this.mapToResponseDto(team));

    return Promise.resolve(result);
  }

  findOne(id: number): Promise<TeamResponseDto> {
    const team = this.teams.find((t) => t.id === id);

    if (!team) {
      return Promise.reject(new EntityNotFoundException('Team', id));
    }

    return Promise.resolve(this.mapToResponseDto(team));
  }

  update(id: number, updateTeamDto: UpdateTeamDto): Promise<TeamResponseDto> {
    const team = this.teams.find((t) => t.id === id);

    if (!team) {
      return Promise.reject(new EntityNotFoundException('Team', id));
    }

    if (updateTeamDto.name !== undefined) {
      team.name = updateTeamDto.name;
    }
    if (updateTeamDto.cityId !== undefined) {
      team.cityId = updateTeamDto.cityId;
    }

    team.updatedAt = new Date();

    return Promise.resolve(this.mapToResponseDto(team));
  }

  remove(id: number): Promise<void> {
    const index = this.teams.findIndex((t) => t.id === id);

    if (index === -1) {
      return Promise.reject(new EntityNotFoundException('Team', id));
    }

    this.teams.splice(index, 1);
    return Promise.resolve();
  }

  private mapToResponseDto(team: TeamStub): TeamResponseDto {
    return {
      id: team.id,
      name: team.name,
      cityId: team.cityId,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };
  }
}
