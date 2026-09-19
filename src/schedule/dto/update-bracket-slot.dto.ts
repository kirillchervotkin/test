import { PartialType } from '@nestjs/swagger';
import { CreateBracketSlotDto } from './create-bracket-slot.dto.js';
export class UpdateBracketSlotDto extends PartialType(CreateBracketSlotDto, {
  skipNullProperties: false,
}) {}
