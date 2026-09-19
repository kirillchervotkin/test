import type { TemplateSchema } from '../entities/types/schedule.types.js';
import { Constraint } from '../../common/decorators/unique.decorator.js';
import { PartialType } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto.js';
export class UpdateTemplateDto extends PartialType(CreateTemplateDto, {
  skipNullProperties: false,
}) {
 @Constraint({ dbField: 'schema', messages: { foreignKey: 'validation.TEMPLATE_REFERENCE_NOT_FOUND' } })
 schema?: TemplateSchema;
}
