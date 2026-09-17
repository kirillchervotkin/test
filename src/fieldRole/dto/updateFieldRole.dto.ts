import { PartialType } from '@nestjs/swagger';
import { CreateFieldRoleDto } from './createFieldRole.dto.js';

export class UpdateFieldRoleDto extends PartialType(CreateFieldRoleDto) {}
