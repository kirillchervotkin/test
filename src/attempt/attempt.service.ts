// src/attempts/attempt.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { AttemptYdbRepository } from './attempt.repository.js';
import {
  Attempt,
  CreateAttemptData,
  UpdateAttemptData,
} from './entities/attempt.types.js';

@Injectable()
export class AttemptService {
  constructor(private readonly attemptRepository: AttemptYdbRepository) {}

  // ============================================================
  //  СОЗДАНИЕ
  // ============================================================
  async createAttempt(data: CreateAttemptData): Promise<Attempt> {
    return this.attemptRepository.create(data);
  }

  // ============================================================
  //  ПОИСК ПО ID (возвращает null, если не найден)
  // ============================================================
  async findAttemptById(id: string): Promise<Attempt | null> {
    return this.attemptRepository.findById(id);
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ (если не найден – бросает NotFoundException)
  // ============================================================
  async updateAttempt(data: UpdateAttemptData): Promise<Attempt> {
    const updated = await this.attemptRepository.updatePartial(data);
    if (!updated) {
      throw new NotFoundException(`Attempt with id ${data.id} not found`);
    }
    return updated;
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ СПИСКА С ПАГИНАЦИЕЙ И ФИЛЬТРАМИ
  // ============================================================
  async findAll(params: {
    limit?: number;
    offset?: number;
    filter?: { userId?: string; testType?: string; trainingCampId?: string };
    orderBy?: 'test_date' | 'test_type' | 'attempt_number';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<{ rows: Attempt[]; total: number }> {
    return this.attemptRepository.findAll(
      params.limit ?? 100,
      params.offset ?? 0,
      params.filter,
      params.orderBy ?? 'test_date',
      params.orderDir ?? 'DESC',
    );
  }

  // ============================================================
  //  УДАЛЕНИЕ (проверяет существование перед удалением)
  // ============================================================
  async deleteAttempt(id: string): Promise<void> {
    const deleted = await this.attemptRepository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Attempt with id ${id} not found`);
    }
  }
}
