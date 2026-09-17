import { PartialType } from '@nestjs/swagger';
import { CreateTeamDto } from './createTeam.dto.js';

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}
