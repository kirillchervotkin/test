import { PartialType } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto.js';
export class UpdateTemplateDto extends PartialType(CreateTemplateDto, {
  skipNullProperties: false,
}) {}
