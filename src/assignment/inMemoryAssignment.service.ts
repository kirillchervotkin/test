import {
  Injectable,
  NotFoundException,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { AssignmentService } from './interfaces/assignmentService.interface.js';
import { AssignmentResponseDto } from './dto/assignmentResponse.dto.js';
import { CreateAssignmentDto } from './dto/createAssignment.dto.js';
import type { MatchService } from '../match/interfaces/matchService.interface.js';
import { MATCHES_SERVICE } from '../match/tokens.js';
import { UpdateAssignmentDto } from './dto/updateAssignment.dto.js';

@Injectable()
export class InMemoryAssignmentService implements AssignmentService {
  private assignments: AssignmentResponseDto[] = [
    {
      id: 1,
      matchId: '1',
      userId: 101,
      fieldRoleId: 1,
      createdAt: '2023-09-01T00:00:00.000Z',
      updatedAt: '2023-09-01T00:00:00.000Z',
    },
    {
      id: 2,
      matchId: '1',
      userId: 102,
      fieldRoleId: 2,
      createdAt: '2023-09-01T00:00:00.000Z',
      updatedAt: '2023-09-01T00:00:00.000Z',
    },
    {
      id: 3,
      matchId: '1',
      userId: 103,
      fieldRoleId: 2,
      createdAt: '2023-09-01T00:00:00.000Z',
      updatedAt: '2023-09-01T00:00:00.000Z',
    },
    {
      id: 4,
      matchId: '2',
      userId: 104,
      fieldRoleId: 1,
      createdAt: '2023-09-02T00:00:00.000Z',
      updatedAt: '2023-09-02T00:00:00.000Z',
    },
    {
      id: 5,
      matchId: '2',
      userId: 105,
      fieldRoleId: 4,
      createdAt: '2023-09-02T00:00:00.000Z',
      updatedAt: '2023-09-02T00:00:00.000Z',
    },
  ];

  private users = [
    { id: 101, name: 'Иван Петров' },
    { id: 102, name: 'Алексей Смирнов' },
    { id: 103, name: 'Дмитрий Иванов' },
    { id: 104, name: 'Сергей Кузнецов' },
    { id: 105, name: 'Михаил Попов' },
    { id: 106, name: 'Андрей Васильев' },
    { id: 107, name: 'Павел Николаев' },
    { id: 108, name: 'Константин Федоров' },
  ];

  private fieldRoles = [
    { id: 1, name: 'Главный судья' },
    { id: 2, name: 'Помощник судьи' },
    { id: 3, name: 'Резервный судья' },
    { id: 4, name: 'VAR' },
    { id: 5, name: 'AVAR' },
  ];

  private idCounter = 6;

  constructor(
    @Inject(MATCHES_SERVICE)
    private readonly matchesService: MatchService,
  ) {}

  async findOne(id: number): Promise<AssignmentResponseDto> {
    const assignment = this.assignments.find(
      (assignment) => assignment.id === id,
    );

    if (!assignment) {
      throw new NotFoundException(`Назначение с ID ${id} не найдено`);
    }

    return assignment;
  }

  async create(
    matchId: string,
    createAssignmentDto: CreateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    await this.matchesService.findOne(matchId);

    const existingAssignment = this.assignments.find(
      (assignment) =>
        assignment.matchId === matchId &&
        assignment.userId === createAssignmentDto.userId,
    );

    if (existingAssignment) {
      throw new NotFoundException(
        `Пользователь с ID ${createAssignmentDto.userId} уже назначен на этот матч`,
      );
    }

    const user = this.users.find((u) => u.id === createAssignmentDto.userId);
    if (!user) {
      throw new NotFoundException(
        `Пользователь с ID ${createAssignmentDto.userId} не найден`,
      );
    }

    const fieldRole = this.fieldRoles.find(
      (r) => r.id === createAssignmentDto.fieldRoleId,
    );
    if (!fieldRole) {
      throw new NotFoundException(
        `Роль с ID ${createAssignmentDto.fieldRoleId} не найдена`,
      );
    }

    const now = new Date().toISOString();
    const newAssignment: AssignmentResponseDto = {
      id: this.idCounter++,
      matchId,
      userId: createAssignmentDto.userId,
      fieldRoleId: createAssignmentDto.fieldRoleId,
      createdAt: now,
      updatedAt: now,
    };

    this.assignments.push(newAssignment);
    return newAssignment;
  }

  async findAllByMatch(matchId: string): Promise<AssignmentResponseDto[]> {
    await this.matchesService.findOne(matchId);

    return this.assignments.filter(
      (assignment) => assignment.matchId === matchId,
    );
  }

  async remove(id: number): Promise<{ message: string }> {
    const index = this.assignments.findIndex(
      (assignment) => assignment.id === id,
    );

    if (index === -1) {
      throw new NotFoundException(`Назначение с ID ${id} не найдено`);
    }

    this.assignments.splice(index, 1);
    return { message: `Назначение с ID ${id} успешно удалено` };
  }

  async update(
    id: number,
    updateAssignmentDto: UpdateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    const assignment = await this.findOne(id);
    const assignmentIndex = this.assignments.findIndex((a) => a.id === id);

    // Если меняем пользователя
    if (updateAssignmentDto.userId !== undefined) {
      // Проверяем, что новый пользователь не назначен на этот же матч
      const existingAssignment = this.assignments.find(
        (a) =>
          a.matchId === assignment.matchId &&
          a.userId === updateAssignmentDto.userId &&
          a.id !== id, // исключаем текущее назначение из проверки
      );

      if (existingAssignment) {
        throw new ConflictException(
          `Пользователь с ID ${updateAssignmentDto.userId} уже назначен на этот матч`,
        );
      }

      // Проверяем существование пользователя
      const user = this.users.find((u) => u.id === updateAssignmentDto.userId);
      if (!user) {
        throw new NotFoundException(
          `Пользователь с ID ${updateAssignmentDto.userId} не найден`,
        );
      }

      this.assignments[assignmentIndex].userId = updateAssignmentDto.userId;
    }

    // Если меняем роль
    if (updateAssignmentDto.fieldRoleId !== undefined) {
      const fieldRole = this.fieldRoles.find(
        (r) => r.id === updateAssignmentDto.fieldRoleId,
      );
      if (!fieldRole) {
        throw new NotFoundException(
          `Роль с ID ${updateAssignmentDto.fieldRoleId} не найдена`,
        );
      }

      this.assignments[assignmentIndex].fieldRoleId =
        updateAssignmentDto.fieldRoleId;
    }

    // Обновляем дату изменения
    this.assignments[assignmentIndex].updatedAt = new Date().toISOString();

    return this.assignments[assignmentIndex];
  }
}
