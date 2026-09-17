import { CreateRoleDto } from '../dto/createRole.dto.js';
import { UpdateRoleDto } from '../dto/updateRole.dto.js';
import { RoleResponseDto } from '../dto/roleResponse.dto.js';

export interface RoleService {
  findAll(): RoleResponseDto[];
  findOne(id: number): RoleResponseDto;
  create(createRoleDto: CreateRoleDto): RoleResponseDto;
  update(id: number, updateRoleDto: UpdateRoleDto): RoleResponseDto;
  remove(id: number): { message: string };
}
