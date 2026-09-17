import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { RoleResponseDto } from './dto/roleResponse.dto.js';
import { RoleService } from './interfaces/roleService.interface.js';
import { CreateRoleDto } from './dto/createRole.dto.js';
import { UpdateRoleDto } from './dto/updateRole.dto.js';

@Injectable()
export class InMemoryRoleService implements RoleService {
  private roles: RoleResponseDto[] = [
    {
      id: 1,
      name: 'Администратор',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Пользователь',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 3,
      name: 'Модератор',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
  ];

  private idCounter = 4;

  findAll(): RoleResponseDto[] {
    return this.roles;
  }

  findOne(id: number): RoleResponseDto {
    const role = this.roles.find((r) => r.id === id);
    if (!role) {
      throw new NotFoundException(`Роль с ID ${id} не найдена`);
    }
    return role;
  }

  create(createRoleDto: CreateRoleDto): RoleResponseDto {
    // Проверка уникальности имени
    const existingRole = this.roles.find((r) => r.name === createRoleDto.name);
    if (existingRole) {
      throw new BadRequestException(
        `Роль с именем "${createRoleDto.name}" уже существует`,
      );
    }

    const now = new Date().toISOString();
    const newRole: RoleResponseDto = {
      id: this.idCounter++,
      ...createRoleDto,
      createdAt: now,
      updatedAt: now,
    };

    this.roles.push(newRole);
    return newRole;
  }

  update(id: number, updateRoleDto: UpdateRoleDto): RoleResponseDto {
    const index = this.roles.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new NotFoundException(`Роль с ID ${id} не найдена`);
    }

    // Если передан name и он отличается от текущего, проверяем уникальность
    if (updateRoleDto.name && updateRoleDto.name !== this.roles[index].name) {
      const existingRole = this.roles.find(
        (r) => r.id !== id && r.name === updateRoleDto.name,
      );
      if (existingRole) {
        throw new BadRequestException(
          `Роль с именем "${updateRoleDto.name}" уже существует`,
        );
      }
    }

    const updatedRole = {
      ...this.roles[index],
      ...updateRoleDto,
      updatedAt: new Date().toISOString(),
    };

    this.roles[index] = updatedRole;
    return updatedRole;
  }

  remove(id: number): { message: string } {
    const index = this.roles.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new NotFoundException(`Роль с ID ${id} не найдена`);
    }

    this.roles.splice(index, 1);
    return { message: `Роль с ID ${id} успешно удалена` };
  }
}
