import { PartialType } from '@nestjs/swagger';
import { CreateTeamSlotDto } from './create-team-slot.dto.js';
export class UpdateTeamSlotDto extends PartialType(CreateTeamSlotDto, {
  skipNullProperties: false,
}) {}
