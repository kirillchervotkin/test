// src/camp-participant/camp-participant.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { CampParticipantYdbRepository } from './repository/camp-participant.ydb.repository.js';
import {
  CampParticipant,
  CreateCampParticipantData,
  CampParticipantWithUser,
} from './entities/types/camp-participant.types.js';
import { CreateCampParticipantDto } from './dto/create-camp-participant.dto.js';
import { BulkAddParticipantsDto } from './dto/bulk-add-participants.dto.js';
import { BulkRemoveParticipantsDto } from './dto/bulk-remove-participants.dto.js';
import { UpdateBibDto } from './dto/update-bib.dto.js';

@Injectable()
export class CampParticipantService {
  constructor(private readonly repository: CampParticipantYdbRepository) {}

  /**
   * Добавление одного участника в лагерь.
   * Bib назначается автоматически (max(bib)+1).
   */
  async create(
    campId: string,
    dto: CreateCampParticipantDto,
  ): Promise<CampParticipant> {
    const data: CreateCampParticipantData = {
      campId,
      userId: dto.userId,
    };
    return this.repository.create(data);
  }

  /**
   * Массовое добавление участников в лагерь.
   */
  async bulkAdd(
    campId: string,
    dto: BulkAddParticipantsDto,
  ): Promise<CampParticipant[]> {
    return this.repository.bulkAddParticipants(campId, dto.userIds);
  }

  /**
   * Массовое удаление участников из лагеря.
   */
  async bulkRemove(
    campId: string,
    dto: BulkRemoveParticipantsDto,
  ): Promise<CampParticipant[]> {
    return this.repository.bulkRemoveParticipants(campId, dto.userIds);
  }

  /**
   * Ручное обновление номера (bib) участника.
   */
  async updateBib(
    campId: string,
    userId: string,
    dto: UpdateBibDto,
  ): Promise<CampParticipant> {
    const updated = await this.repository.updateBib(campId, userId, dto.bib);
    if (!updated) {
      throw new NotFoundException(
        `Participant with campId ${campId} and userId ${userId} not found`,
      );
    }
    return updated;
  }

  /**
   * Поиск участника по составному ключу (campId, userId).
   */
  async findOne(
    campId: string,
    userId: string,
  ): Promise<CampParticipant | null> {
    return this.repository.findByComposite(campId, userId);
  }

  /**
   * Удаление одного участника из лагеря.
   */
  async deleteOne(campId: string, userId: string): Promise<CampParticipant> {
    const deleted = await this.repository.deleteByComposite(campId, userId);
    if (!deleted) {
      throw new NotFoundException(
        `Participant with campId ${campId} and userId ${userId} not found`,
      );
    }
    return deleted;
  }

  /**
   * Получение всех участников конкретного лагеря с данными пользователей.
   */
  async findAllByCamp(campId: string): Promise<CampParticipantWithUser[]> {
    return this.repository.findAllByCamp(campId);
  }

  /**
   * Получение всех записей участника во всех лагерях (без данных пользователя).
   */
  async findAllByUser(userId: string): Promise<CampParticipant[]> {
    return this.repository.findAllByUser(userId);
  }

  /**
   * Удаление всех участников из лагеря (очистка лагеря).
   */
  async deleteAllByCamp(campId: string): Promise<void> {
    await this.repository.deleteAllByCamp(campId);
  }

  /**
   * Проверка, является ли пользователь участником лагеря.
   */
  async exists(campId: string, userId: string): Promise<boolean> {
    return this.repository.exists(campId, userId);
  }
}
