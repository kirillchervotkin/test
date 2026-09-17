import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { ListRoleResponseDto } from './dto/listRoleResponse.dto.js';
import { ListRoleService } from './interfaces/listRoleService.interface.js';
import { ROLE_SERVICE } from 'src/role/tokens.js';
import type { RoleService } from 'src/role/interfaces/roleService.interface.js';
import { ListService } from 'src/list/list.service.js';
import { CreateListRoleDto } from './dto/createListRole.dto.js';

@Injectable()
export class InMemoryListRoleService implements ListRoleService {
  private listRoles: ListRoleResponseDto[] = [
    {
      id: 1,
      listId: 1,
      roleId: 1,
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      listId: 1,
      roleId: 2,
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 3,
      listId: 2,
      roleId: 3,
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
  ];

  private idCounter = 4;

  constructor(
    @Inject(ROLE_SERVICE)
    private readonly roleService: RoleService,
    private readonly listService: ListService,
  ) {}

  addRoleToList(
    listId: number,
    createListRoleDto: CreateListRoleDto,
  ): ListRoleResponseDto {
    // Проверяем существование списка
    try {
      // В реальной реализации: await this.listService.getListById(listId)
      // Для fake API просто проверяем, что listId есть в существующих связях или используем заглушку
      if (listId < 1) {
        throw new NotFoundException(`Список с ID ${listId} не найден`);
      }
    } catch (_) {
      throw new NotFoundException(`Список с ID ${listId} не найден`);
    }

    // Проверяем существование роли
    try {
      this.roleService.findOne(createListRoleDto.roleId);
    } catch (_) {
      throw new NotFoundException(
        `Роль с ID ${createListRoleDto.roleId} не найдена`,
      );
    }

    // Проверяем, не добавлена ли уже эта роль к списку
    const existingListRole = this.listRoles.find(
      (lr) => lr.listId === listId && lr.roleId === createListRoleDto.roleId,
    );

    if (existingListRole) {
      throw new ConflictException(
        `Роль с ID ${createListRoleDto.roleId} уже добавлена к списку с ID ${listId}`,
      );
    }

    const now = new Date().toISOString();
    const newListRole: ListRoleResponseDto = {
      id: this.idCounter++,
      listId,
      roleId: createListRoleDto.roleId,
      createdAt: now,
      updatedAt: now,
    };

    this.listRoles.push(newListRole);

    // Добавляем информацию о роли в ответ
    const role = this.roleService.findOne(createListRoleDto.roleId);
    return {
      ...newListRole,
      role,
    };
  }

  getListRoles(listId: number): ListRoleResponseDto[] {
    // Проверяем существование списка
    if (listId < 1) {
      throw new NotFoundException(`Список с ID ${listId} не найден`);
    }

    const listRoles = this.listRoles.filter((lr) => lr.listId === listId);

    // Добавляем информацию о ролях
    return listRoles.map((listRole) => ({
      ...listRole,
      role: this.roleService.findOne(listRole.roleId),
    }));
  }

  getListRole(listId: number, roleId: number): ListRoleResponseDto {
    // Проверяем существование списка
    if (listId < 1) {
      throw new NotFoundException(`Список с ID ${listId} не найден`);
    }

    const listRole = this.listRoles.find(
      (lr) => lr.listId === listId && lr.roleId === roleId,
    );

    if (!listRole) {
      throw new NotFoundException(
        `Роль с ID ${roleId} не найдена в списке с ID ${listId}`,
      );
    }

    // Добавляем информацию о роли
    const role = this.roleService.findOne(roleId);
    return {
      ...listRole,
      role,
    };
  }

  removeRoleFromList(listId: number, roleId: number): { message: string } {
    // Проверяем существование списка
    if (listId < 1) {
      throw new NotFoundException(`Список с ID ${listId} не найден`);
    }

    const index = this.listRoles.findIndex(
      (lr) => lr.listId === listId && lr.roleId === roleId,
    );

    if (index === -1) {
      throw new NotFoundException(
        `Роль с ID ${roleId} не найдена в списке с ID ${listId}`,
      );
    }

    this.listRoles.splice(index, 1);
    return {
      message: `Роль с ID ${roleId} успешно удалена из списка с ID ${listId}`,
    };
  }
}
