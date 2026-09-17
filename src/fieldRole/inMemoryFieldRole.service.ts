import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FieldRoleResponseDto } from './dto/fieldRoleResponse.dto.js';

import { CreateFieldRoleDto } from './dto/createFieldRole.dto.js';
import { UpdateFieldRoleDto } from './dto/updateFieldRole.dto.js';
import { FieldRoleService } from './interfaces/fieldRoleService.interface.js';

@Injectable()
export class InMemoryFieldRoleService implements FieldRoleService {
  private fieldRoles: FieldRoleResponseDto[] = [
    {
      id: 1,
      name: 'Главный судья',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Первый помощник судьи',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 3,
      name: 'Второй помощник судьи',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 4,
      name: 'Резервный судья',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 5,
      name: 'Видеопомощник судьи (VAR)',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 6,
      name: 'Судья в поле',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
    {
      id: 7,
      name: 'Четвертый судья',
      createdAt: '2022-01-01T00:00:00.000Z',
      updatedAt: '2022-01-01T00:00:00.000Z',
    },
  ];

  private idCounter = 8;

  findAll(): FieldRoleResponseDto[] {
    return this.fieldRoles;
  }

  findOne(id: number): FieldRoleResponseDto {
    const fieldRole = this.fieldRoles.find((r) => r.id === id);
    if (!fieldRole) {
      throw new NotFoundException(`Роль на поле с ID ${id} не найдена`);
    }
    return fieldRole;
  }

  create(createFieldRoleDto: CreateFieldRoleDto): FieldRoleResponseDto {
    // Проверка уникальности имени
    const existingRole = this.fieldRoles.find(
      (r) => r.name === createFieldRoleDto.name,
    );
    if (existingRole) {
      throw new BadRequestException(
        `Роль на поле с именем "${createFieldRoleDto.name}" уже существует`,
      );
    }

    const now = new Date().toISOString();
    const newFieldRole: FieldRoleResponseDto = {
      id: this.idCounter++,
      name: createFieldRoleDto.name,
      createdAt: now,
      updatedAt: now,
    };

    this.fieldRoles.push(newFieldRole);
    return newFieldRole;
  }

  update(
    id: number,
    updateFieldRoleDto: UpdateFieldRoleDto,
  ): FieldRoleResponseDto {
    const index = this.fieldRoles.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new NotFoundException(`Роль на поле с ID ${id} не найдена`);
    }

    // Если передан name и он отличается от текущего, проверяем уникальность
    if (
      updateFieldRoleDto.name &&
      updateFieldRoleDto.name !== this.fieldRoles[index].name
    ) {
      const existingRole = this.fieldRoles.find(
        (r) => r.id !== id && r.name === updateFieldRoleDto.name,
      );
      if (existingRole) {
        throw new BadRequestException(
          `Роль на поле с именем "${updateFieldRoleDto.name}" уже существует`,
        );
      }
    }

    const updatedFieldRole = {
      ...this.fieldRoles[index],
      ...updateFieldRoleDto,
      updatedAt: new Date().toISOString(),
    };

    this.fieldRoles[index] = updatedFieldRole;
    return updatedFieldRole;
  }

  remove(id: number): { message: string } {
    const index = this.fieldRoles.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new NotFoundException(`Роль на поле с ID ${id} не найдена`);
    }

    this.fieldRoles.splice(index, 1);
    return { message: `Роль на поле с ID ${id} успешно удалена` };
  }
}
