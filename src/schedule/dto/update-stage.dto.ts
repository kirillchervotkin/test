import { PartialType } from '@nestjs/swagger';
import { CreateStageDto } from './create-stage.dto.js';
export class UpdateStageDto extends PartialType(CreateStageDto, {
  skipNullProperties: false,
}) {}
