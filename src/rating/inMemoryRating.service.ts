import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import type { AssignmentService } from 'src/assignment/interfaces/assignmentService.interface.js';
import { ASSIGNMENTS_SERVICE } from 'src/assignment/tokens.js';
import { CreateRatingDto } from './dto/createRating.dto.js';
import { UpdateRatingDto } from './dto/updateRating.dto.js';
import { RatingResponseDto } from './dto/ratingResponse.dto.js';
import { RatingService } from './interfaces/ratingService.interface.js';

@Injectable()
export class InMemoryRatingService implements RatingService {
  private ratings: RatingResponseDto[] = [
    {
      id: 1,
      assignmentId: 1,
      matchId: 1,
      userId: 101,
      roleId: 1,
      rating: 9,
      comment: 'Отличная работа, четкое управление матчем',
      createdAt: '2023-09-01T10:00:00.000Z',
      updatedAt: '2023-09-01T10:00:00.000Z',
    },
    {
      id: 2,
      assignmentId: 2,
      matchId: 1,
      userId: 102,
      roleId: 2,
      rating: 8,
      comment: 'Хорошая работа, правильные определения офсайдов',
      createdAt: '2023-09-01T10:00:00.000Z',
      updatedAt: '2023-09-01T10:00:00.000Z',
    },
    {
      id: 3,
      assignmentId: 4,
      matchId: 2,
      userId: 104,
      roleId: 1,
      rating: 7,
      comment: 'Нормальная работа, но были спорные моменты',
      createdAt: '2023-09-02T10:00:00.000Z',
      updatedAt: '2023-09-02T10:00:00.000Z',
    },
  ];

  private idCounter = 4;

  constructor(
    @Inject(ASSIGNMENTS_SERVICE)
    private readonly assignmentService: AssignmentService,
  ) {}

  // Создает новую оценку для указанного назначения
  create(
    assignmentId: number,
    createRatingDto: CreateRatingDto,
  ): RatingResponseDto {
    // Проверяем существование назначения
    const assignment = this.assignmentService.findOne(assignmentId);

    // Проверяем, существует ли уже оценка для этого назначения
    const existingRating = this.ratings.find(
      (rating) => rating.assignmentId === assignmentId,
    );

    if (existingRating) {
      throw new NotFoundException(
        `Оценка для назначения с ID ${assignmentId} уже существует. Используйте update для обновления`,
      );
    }

    const now = new Date().toISOString();

    // Создаем новую оценку
    const newRating: RatingResponseDto = {
      id: this.idCounter++,
      assignmentId,
      matchId: assignment.matchId,
      userId: assignment.userId,
      roleId: assignment.fieldRoleId,
      rating: createRatingDto.rating,
      comment: createRatingDto.comment,
      createdAt: now,
      updatedAt: now,
    };

    this.ratings.push(newRating);
    return newRating;
  }

  // Полностью обновляет существующую оценку по её ID (заменяет все поля из CreateDto)
  update(id: number, createRatingDto: CreateRatingDto): RatingResponseDto {
    const existingRatingIndex = this.ratings.findIndex(
      (rating) => rating.id === id,
    );

    if (existingRatingIndex === -1) {
      throw new NotFoundException(`Оценка с ID ${id} не найдена`);
    }

    const now = new Date().toISOString();

    // Полностью обновляем оценку: rating всегда обязателен, comment может быть undefined
    this.ratings[existingRatingIndex] = {
      ...this.ratings[existingRatingIndex],
      rating: createRatingDto.rating,
      comment: createRatingDto.comment, // Если comment не передан, будет undefined
      updatedAt: now,
    };

    return this.ratings[existingRatingIndex];
  }

  // Частично обновляет существующую оценку по её ID (только переданные поля)
  patch(id: number, updateRatingDto: UpdateRatingDto): RatingResponseDto {
    const existingRatingIndex = this.ratings.findIndex(
      (rating) => rating.id === id,
    );

    if (existingRatingIndex === -1) {
      throw new NotFoundException(`Оценка с ID ${id} не найдена`);
    }

    const now = new Date().toISOString();

    // Создаем объект с обновлениями
    const updates: Partial<RatingResponseDto> = {
      updatedAt: now,
    };

    // Добавляем только те поля, которые переданы в DTO
    if (updateRatingDto.rating !== undefined) {
      updates.rating = updateRatingDto.rating;
    }
    if (updateRatingDto.comment !== undefined) {
      updates.comment = updateRatingDto.comment;
    }

    // Применяем обновления
    this.ratings[existingRatingIndex] = {
      ...this.ratings[existingRatingIndex],
      ...updates,
    };

    return this.ratings[existingRatingIndex];
  }

  // Находит оценку по её ID
  findOne(id: number): RatingResponseDto {
    const rating = this.ratings.find((rating) => rating.id === id);

    if (!rating) {
      throw new NotFoundException(`Оценка с ID ${id} не найдена`);
    }

    return rating;
  }

  // Находит оценку по ID назначения
  findByAssignmentId(assignmentId: number): RatingResponseDto {
    // Проверяем существование назначения
    this.assignmentService.findOne(assignmentId);

    const rating = this.ratings.find(
      (rating) => rating.assignmentId === assignmentId,
    );

    if (!rating) {
      throw new NotFoundException(
        `Оценка для назначения с ID ${assignmentId} не найдена`,
      );
    }

    return rating;
  }

  // Удаляет оценку по её ID
  remove(id: number): { message: string } {
    const index = this.ratings.findIndex((rating) => rating.id === id);

    if (index === -1) {
      throw new NotFoundException(`Оценка с ID ${id} не найдена`);
    }

    this.ratings.splice(index, 1);
    return {
      message: `Оценка с ID ${id} успешно удалена`,
    };
  }

  // Удаляет оценку по ID назначения
  removeByAssignmentId(assignmentId: number): { message: string } {
    // Проверяем существование назначения
    this.assignmentService.findOne(assignmentId);

    const index = this.ratings.findIndex(
      (rating) => rating.assignmentId === assignmentId,
    );

    if (index === -1) {
      throw new NotFoundException(
        `Оценка для назначения с ID ${assignmentId} не найдена`,
      );
    }

    this.ratings.splice(index, 1);
    return {
      message: `Оценка для назначения с ID ${assignmentId} успешно удалена`,
    };
  }

  // Получает все оценки
  findAll(): RatingResponseDto[] {
    return this.ratings;
  }

  // Получает все оценки для указанного назначения
  // ЗАМЕЧАНИЕ: Этот метод не используется в контроллере, но оставлю его на случай будущего использования
  findAllByAssignmentId(assignmentId: number): RatingResponseDto[] {
    // Проверяем существование назначения
    this.assignmentService.findOne(assignmentId);

    return this.ratings.filter(
      (rating) => rating.assignmentId === assignmentId,
    );
  }

  // Получает все оценки для указанного пользователя
  findAllByUserId(userId: number): RatingResponseDto[] {
    return this.ratings.filter((rating) => rating.userId === userId);
  }

  // Получает все оценки для указанного матча
  findAllByMatchId(matchId: number): RatingResponseDto[] {
    return this.ratings.filter((rating) => rating.matchId === matchId);
  }
}
