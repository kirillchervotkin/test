import { CreateFieldRoleDto } from '../dto/createFieldRole.dto.js';
import { FieldRoleResponseDto } from '../dto/fieldRoleResponse.dto.js';
import { UpdateFieldRoleDto } from '../dto/updateFieldRole.dto.js';

export interface FieldRoleService {
  findAll(): FieldRoleResponseDto[];
  findOne(id: number): FieldRoleResponseDto;
  create(createFieldRoleDto: CreateFieldRoleDto): FieldRoleResponseDto;
  update(
    id: number,
    updateFieldRoleDto: UpdateFieldRoleDto,
  ): FieldRoleResponseDto;
  remove(id: number): { message: string };
}
