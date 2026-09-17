// src/training-camps/training-camp.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TrainingCamp,
  CreateTrainingCampData,
  UpdateTrainingCampData,
} from './entities/types/training-camp.types.js';
import { TrainingCampYdbRepository } from './training-camp.repository.js';

@Injectable()
export class TrainingCampService {
  constructor(private readonly campRepository: TrainingCampYdbRepository) {}

  // ============================================================
  //  СОЗДАНИЕ
  // ============================================================
  async createCamp(data: CreateTrainingCampData): Promise<TrainingCamp> {
    return this.campRepository.create(data);
  }

  // ============================================================
  //  ПОИСК ПО ID (возвращает null, если не найден)
  // ============================================================
  async findCampById(id: string): Promise<TrainingCamp | null> {
    return this.campRepository.findById(id);
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ (если не найден – бросает NotFoundException)
  // ============================================================
  async updateCamp(data: UpdateTrainingCampData): Promise<TrainingCamp> {
    const updated = await this.campRepository.updatePartial(data);
    if (!updated) {
      throw new NotFoundException(`Training camp with id ${data.id} not found`);
    }
    return updated;
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ СПИСКА С ПАГИНАЦИЕЙ И ФИЛЬТРАМИ
  // ============================================================
  async findAll(params: {
    limit?: number;
    offset?: number;
    filter?: { name?: string; location?: string };
    orderBy?: 'start_date' | 'end_date' | 'name';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<{ rows: TrainingCamp[]; total: number }> {
    return this.campRepository.findAll(
      params.limit ?? 100,
      params.offset ?? 0,
      params.filter,
      params.orderBy ?? 'name',
      params.orderDir ?? 'DESC',
    );
  }

  // ============================================================
  //  УДАЛЕНИЕ (проверяет существование перед удалением)
  // ============================================================
  async deleteCamp(id: string): Promise<void> {
    const camp = await this.campRepository.findById(id);
    if (!camp) {
      throw new NotFoundException(`Training camp with id ${id} not found`);
    }
    await this.campRepository.delete(id);
  }
}
