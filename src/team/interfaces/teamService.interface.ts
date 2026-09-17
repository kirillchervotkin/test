import { CreateTeamDto } from '../dto/createTeam.dto.js';
import { UpdateTeamDto } from '../dto/updateTeam.dto.js';
import { TeamResponseDto } from '../dto/teamResponse.dto.js';

export interface TeamService {
  create(createTeamDto: CreateTeamDto): Promise<TeamResponseDto>;
  findAll(): Promise<TeamResponseDto[]>;
  findOne(id: number): Promise<TeamResponseDto>;
  update(id: number, updateTeamDto: UpdateTeamDto): Promise<TeamResponseDto>;
  remove(id: number): Promise<void>;
}
