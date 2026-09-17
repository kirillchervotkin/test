import { Injectable, Inject } from '@nestjs/common';
import { GroupsService } from './interfaces/groupService.interface.js';
import { GroupResponseDto } from './dto/groupResponse.dto.js';
import { CreateGroupDto } from './dto/createGroup.dto.js';
import { UpdateGroupDto } from './dto/updateGroup.dto.js';
import { EntityNotFoundException } from '../common/exceptions/entityNotFound.exception.js';
import type { TournamentsService } from '../tournament/interfaces/tournamentService.interface.js';
import { TOURNAMENTS_SERVICE } from '../tournament/tokens.js';

interface GroupStub {
  id: number;
  name: string;
  description?: string;
  tournamentId: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TypeOrmGroupsService implements GroupsService {
  private groups: GroupStub[] = [];
  private nextId = 1;

  constructor(
    @Inject(TOURNAMENTS_SERVICE)
    private readonly tournamentsService: TournamentsService,
  ) {}

  async findAllByTournamentId(
    tournamentId: number,
  ): Promise<GroupResponseDto[]> {
    await this.tournamentsService.findById(tournamentId);

    const result = this.groups
      .filter((g) => g.tournamentId === tournamentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => this.mapToResponseDto(group));

    return result;
  }

  findOne(id: number): Promise<GroupResponseDto> {
    const group = this.groups.find((g) => g.id === id);

    if (!group) {
      return Promise.reject(new EntityNotFoundException('Group', id));
    }

    return Promise.resolve(this.mapToResponseDto(group));
  }

  findOneByTournamentId(
    id: number,
    tournamentId: number,
  ): Promise<GroupResponseDto> {
    const group = this.groups.find(
      (g) => g.id === id && g.tournamentId === tournamentId,
    );

    if (!group) {
      return Promise.reject(new EntityNotFoundException('Group', id));
    }

    return Promise.resolve(this.mapToResponseDto(group));
  }

  async create(
    tournamentId: number,
    createGroupDto: CreateGroupDto,
  ): Promise<GroupResponseDto> {
    await this.tournamentsService.findById(tournamentId);

    const now = new Date();

    const group: GroupStub = {
      id: this.nextId++,
      name: createGroupDto.name,
      description: createGroupDto.description,
      tournamentId,
      createdAt: now,
      updatedAt: now,
    };

    this.groups.push(group);
    return this.mapToResponseDto(group);
  }

  update(
    id: number,
    tournamentId: number,
    updateGroupDto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    const group = this.groups.find(
      (g) => g.id === id && g.tournamentId === tournamentId,
    );

    if (!group) {
      return Promise.reject(new EntityNotFoundException('Group', id));
    }

    if (updateGroupDto.name !== undefined) {
      group.name = updateGroupDto.name;
    }
    if (updateGroupDto.description !== undefined) {
      group.description = updateGroupDto.description;
    }

    group.updatedAt = new Date();

    return Promise.resolve(this.mapToResponseDto(group));
  }

  remove(id: number, tournamentId: number): Promise<void> {
    const index = this.groups.findIndex(
      (g) => g.id === id && g.tournamentId === tournamentId,
    );

    if (index === -1) {
      return Promise.reject(new EntityNotFoundException('Group', id));
    }

    this.groups.splice(index, 1);
    return Promise.resolve();
  }

  private mapToResponseDto(group: GroupStub): GroupResponseDto {
    const responseDto = new GroupResponseDto();
    responseDto.id = group.id;
    responseDto.name = group.name;
    responseDto.description = group.description;
    responseDto.tournamentId = group.tournamentId;
    responseDto.createdAt = group.createdAt.toISOString();
    responseDto.updatedAt = group.updatedAt.toISOString();
    return responseDto;
  }
}
