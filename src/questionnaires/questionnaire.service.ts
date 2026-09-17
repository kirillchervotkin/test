// src/questionnaires/questionnaire.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Questionnaire,
  CreateQuestionnaireData,
  UpdateQuestionnaireData,
  QuestionnaireWithUser,
} from './entities/types/questionnaire.types.js';
import { QuestionnaireRepository } from './repository/questionnaire.repository.js';

@Injectable()
export class QuestionnaireService {
  constructor(private readonly repository: QuestionnaireRepository) {}

  /**
   * Создание или обновление анкеты (upsert) по userId.
   * Если анкета существует – обновляется полностью (заменяется).
   * Если не существует – создаётся новая.
   */
  async upsert(data: CreateQuestionnaireData): Promise<Questionnaire> {
    return this.repository.upsert(data);
  }

  /**
   * Массовое создание или обновление анкет (upsertMany).
   * Каждая анкета в массиве обновляется или создаётся по userId.
   */
  async upsertMany(data: CreateQuestionnaireData[]): Promise<Questionnaire[]> {
    return this.repository.upsertMany(data);
  }

  /**
   * Создание или обновление анкеты по email пользователя.
   * Находит пользователя по email, затем выполняет upsert.
   * @throws NotFoundException если пользователь не найден
   */
  async createByEmail(
    email: string,
    data: Omit<CreateQuestionnaireData, 'userId'>,
  ): Promise<Questionnaire> {
    return this.repository.createByEmail(email, data);
  }

  /**
   * Массовое создание или обновление анкет по email пользователей.
   * Все email проверяются на существование, затем выполняется массовый upsert.
   * @throws NotFoundException если какой-либо email не найден
   */
  async createManyByEmail(
    items: Array<{ email: string } & Omit<CreateQuestionnaireData, 'userId'>>,
  ): Promise<Questionnaire[]> {
    return this.repository.createManyByEmail(items);
  }

  /**
   * Поиск анкеты по userId.
   * @returns анкета или null, если не найдена
   */
  async findByUserId(userId: string): Promise<Questionnaire | null> {
    return this.repository.findByUserId(userId);
  }

  /**
   * Поиск анкеты по userId с присоединёнными данными пользователя (firstName, lastName, email).
   * @returns анкета с данными пользователя или null
   */
  async findWithUserByUserId(
    userId: string,
  ): Promise<QuestionnaireWithUser | null> {
    return this.repository.findWithUserByUserId(userId);
  }

  /**
   * Частичное обновление анкеты по userId.
   * Обновляет только переданные поля.
   * @throws NotFoundException если анкета не найдена
   */
  async update(
    userId: string,
    data: UpdateQuestionnaireData,
  ): Promise<Questionnaire> {
    const updated = await this.repository.update(userId, data);
    if (!updated) {
      throw new NotFoundException(`Questionnaire for user ${userId} not found`);
    }
    return updated;
  }

  /**
   * Удаление анкеты по userId.
   * @throws NotFoundException если анкета не найдена
   */
  async delete(userId: string): Promise<void> {
    const deleted = await this.repository.delete(userId);
    if (!deleted) {
      throw new NotFoundException(`Questionnaire for user ${userId} not found`);
    }
  }

  /**
   * Получение списка анкет с пагинацией, фильтрацией по спискам и пользователям.
   * Возвращает анкеты с присоединёнными данными пользователей (firstName, lastName, email).
   */
  async findAll(params: {
    limit?: number;
    offset?: number;
    listIds?: string[];
    userIds?: string[];
  }): Promise<{ rows: QuestionnaireWithUser[]; total: number }> {
    return this.repository.findAll(params);
  }
}
