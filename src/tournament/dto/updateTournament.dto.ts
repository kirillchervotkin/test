import { PartialType } from '@nestjs/swagger';
import { CreateTournamentDto } from './createTournament.dto.js';

export class UpdateTournamentDto extends PartialType(CreateTournamentDto) {}
