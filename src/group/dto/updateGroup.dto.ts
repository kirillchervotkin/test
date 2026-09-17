import { PartialType } from '@nestjs/swagger';
import { CreateGroupDto } from './createGroup.dto.js';

export class UpdateGroupDto extends PartialType(CreateGroupDto) {}
