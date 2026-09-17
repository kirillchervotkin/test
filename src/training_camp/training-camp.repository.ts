// src/training-camps/repository/training-camp.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, like, desc, asc, sql } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import { YdbUniqueConstraintViolationError } from '@ydbjs/drizzle-adapter';
import { DbUniqueViolationException } from '../common/exceptions/db-unique-violation.exception.js';
import { DRIZZLE } from '../common/ydb/ydb.constants.js';
import { trainingCamps } from './entities/training-camp.schema.js';
import {
  TrainingCamp,
  CreateTrainingCampData,
  UpdateTrainingCampData,
} from './entities/types/training-camp.types.js';

type DrizzleDb = ReturnType<
  typeof import('@ydbjs/drizzle-adapter').createDrizzle
>;

@Injectable()
export class TrainingCampYdbRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  //  CREATE
  // ============================================================
  async create(data: CreateTrainingCampData): Promise<TrainingCamp> {
    const id = uuidv4();

    const raw = {
      id,
      ...data,
      isActive: data.isActive ?? true,
    };

    // Удаляем ключи со значением undefined
    const insertData = Object.fromEntries(
      Object.entries(raw).filter(([_, value]) => value !== undefined),
    );

    try {
      const result = (await this.db
        .insert(trainingCamps)
        .values(insertData)
        .returning({
          id: trainingCamps.id,
          name: trainingCamps.name,
          description: trainingCamps.description,
          startDate: trainingCamps.startDate,
          endDate: trainingCamps.endDate,
          location: trainingCamps.location,
          isActive: trainingCamps.isActive,
        })) as TrainingCamp[];

      const [camp] = result;
      if (!camp) throw new Error('Failed to create camp');
      return camp;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'name', value: data.name },
        ]);
      }
      throw error;
    }
  }

  // ============================================================
  //  FIND
  // ============================================================
  async findById(id: string): Promise<TrainingCamp | null> {
    const result = (await this.db
      .select()
      .from(trainingCamps)
      .where(eq(trainingCamps.id, id))
      .limit(1)) as TrainingCamp[];

    const [camp] = result;
    return camp || null;
  }

  // ============================================================
  //  UPDATE PARTIAL (PATCH)
  // ============================================================
  async updatePartial(
    data: UpdateTrainingCampData,
  ): Promise<TrainingCamp | null> {
    const { id, ...fields } = data;

    // Если нет полей для обновления, возвращаем существующий объект
    if (Object.keys(fields).length === 0) {
      return this.findById(id);
    }

    try {
      const result = (await this.db
        .update(trainingCamps)
        .set(fields) // Drizzle сам игнорирует undefined и обрабатывает null
        .where(eq(trainingCamps.id, id))
        .returning({
          id: trainingCamps.id,
          name: trainingCamps.name,
          description: trainingCamps.description,
          startDate: trainingCamps.startDate,
          endDate: trainingCamps.endDate,
          location: trainingCamps.location,
          isActive: trainingCamps.isActive,
        })) as TrainingCamp[];

      const [camp] = result;
      return camp || null;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'name', value: fields.name },
        ]);
      }
      throw error;
    }
  }

  // ============================================================
  //  FIND ALL
  // ============================================================
  async findAll(
    limit = 100,
    offset = 0,
    filter?: { name?: string; location?: string },
    orderBy: 'start_date' | 'end_date' | 'name' = 'name',
    orderDir: 'ASC' | 'DESC' = 'DESC',
  ): Promise<{ rows: TrainingCamp[]; total: number }> {
    const orderFieldMap = {
      start_date: trainingCamps.startDate,
      end_date: trainingCamps.endDate,
      name: trainingCamps.name,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.name)
      conditions.push(like(trainingCamps.name, `${filter.name}%`));
    if (filter?.location)
      conditions.push(like(trainingCamps.location, `${filter.location}%`));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = (await this.db
      .select()
      .from(trainingCamps)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(trainingCamps.id) : desc(trainingCamps.id),
      )
      .limit(limit)
      .offset(offset)) as TrainingCamp[];

    const countResult = (await this.db
      .select({ count: sql<number>`count(*)` })
      .from(trainingCamps)
      .where(whereClause)) as { count: number }[];

    const [{ count }] = countResult;
    return { rows, total: Number(count ?? 0) };
  }

  // ============================================================
  //  DELETE
  // ============================================================
  async delete(id: string): Promise<void> {
    await this.db.delete(trainingCamps).where(eq(trainingCamps.id, id));
  }

  // ============================================================
  //  ОБРАБОТКА ОШИБОК УНИКАЛЬНОСТИ
  // ============================================================
  private isDuplicateError(error: unknown): boolean {
    if (error instanceof YdbUniqueConstraintViolationError) {
      return true;
    }
    if (error instanceof YDBError && (error.code as number) === 400120) {
      return true;
    }
    if (
      error instanceof Error &&
      'cause' in error &&
      error.cause instanceof YDBError &&
      (error.cause.code as number) === 400120
    ) {
      return true;
    }
    return false;
  }
}
