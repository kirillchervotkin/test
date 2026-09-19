import { PartialType } from '@nestjs/swagger';
import { CreateTournamentDto } from './create-tournament.dto.js';
export class UpdateTournamentDto extends PartialType(CreateTournamentDto, {
  skipNullProperties: false,
}) {}
