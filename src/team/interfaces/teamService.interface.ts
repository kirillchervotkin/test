import { CreateTeamDto } from '../dto/createTeam.dto.js';
import { UpdateTeamDto } from '../dto/updateTeam.dto.js';
import { TeamResponseDto } from '../dto/teamResponse.dto.js';

export interface TeamService {
  create(createTeamDto: CreateTeamDto): Promise<TeamResponseDto>;
  findAll(): Promise<TeamResponseDto[]>;
  findOne(id: string): Promise<TeamResponseDto>;
  update(id: string, updateTeamDto: UpdateTeamDto): Promise<TeamResponseDto>;
  remove(id: string): Promise<void>;
}
