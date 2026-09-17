import { CreateGroupDto } from '../dto/createGroup.dto.js';
import { GroupResponseDto } from '../dto/groupResponse.dto.js';
import { UpdateGroupDto } from '../dto/updateGroup.dto.js';

export interface GroupsService {
  findAllByTournamentId(tournamentId: number): Promise<GroupResponseDto[]>;
  findOneByTournamentId(
    id: number,
    tournamentId: number,
  ): Promise<GroupResponseDto>;
  create(
    tournamentId: number,
    createGroupDto: CreateGroupDto,
  ): Promise<GroupResponseDto>;
  update(
    id: number,
    tournamentId: number,
    updateGroupDto: UpdateGroupDto,
  ): Promise<GroupResponseDto>;
  remove(id: number, tournamentId: number): Promise<void>;
  findOne(id: number): Promise<GroupResponseDto>;
}
