// src/training-camps/mappers/training-camp.mapper.ts

import { CreateTrainingCampDto } from '../dto/create-training-camp.dto.js';
import { TrainingCampResponseDto } from '../dto/response.dto.js';
import { UpdateTrainingCampDto } from '../dto/update-training-camp.dto.js';
import {
  CreateTrainingCampData,
  UpdateTrainingCampData,
  TrainingCamp,
} from '../entities/types/training-camp.types.js';

export class TrainingCampMapper {
  /**
   * Преобразует DTO создания в данные для репозитория.
   * Опциональные поля могут быть undefined – очистка в репозитории.
   */
  static toCreateTrainingCampData(
    dto: CreateTrainingCampDto,
  ): Omit<CreateTrainingCampData, 'isActive'> {
    return {
      name: dto.name,
      startDate: new Date(`${dto.startDate}T00:00:00Z`),
      endDate: new Date(`${dto.endDate}T00:00:00Z`),
      description: dto.description, // может быть undefined
      location: dto.location, // может быть undefined
    };
  }

  /**
   * Преобразует DTO обновления в данные для репозитория.
   * undefined – поле не обновляется, null – явный сброс в NULL.
   */
  static toUpdateTrainingCampData(
    id: string,
    dto: UpdateTrainingCampDto,
  ): UpdateTrainingCampData {
    const data: UpdateTrainingCampData = { id };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.startDate !== undefined)
      data.startDate = new Date(`${dto.startDate}T00:00:00Z`);
    if (dto.endDate !== undefined)
      data.endDate = new Date(`${dto.endDate}T00:00:00Z`);
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return data;
  }

  /**
   * Преобразует доменную сущность в DTO для ответа клиенту.
   * Даты форматируются в строку YYYY-MM-DD.
   */
  static toDto(camp: TrainingCamp): TrainingCampResponseDto {
    return {
      id: camp.id,
      name: camp.name,
      description: camp.description, // уже string | null
      startDate: camp.startDate.toISOString().slice(0, 10),
      endDate: camp.endDate.toISOString().slice(0, 10),
      location: camp.location, // уже string | null
      isActive: camp.isActive,
    };
  }
}
