import { PartialType } from '@nestjs/swagger';
import { CreateMatchDto } from './create-match.dto.js';
export class UpdateMatchDto extends PartialType(CreateMatchDto, {
  skipNullProperties: false,
}) {}
