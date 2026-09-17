import { CreateListRoleDto } from '../dto/createListRole.dto.js';
import { ListRoleResponseDto } from '../dto/listRoleResponse.dto.js';

export interface ListRoleService {
  addRoleToList(
    listId: number,
    createListRoleDto: CreateListRoleDto,
  ): ListRoleResponseDto;
  getListRoles(listId: number): ListRoleResponseDto[];
  getListRole(listId: number, roleId: number): ListRoleResponseDto;
  removeRoleFromList(listId: number, roleId: number): { message: string };
}
