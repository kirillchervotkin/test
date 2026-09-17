// src/attempts/repository/attempt.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, sql, asc, desc } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import { YdbUniqueConstraintViolationError } from '@ydbjs/drizzle-adapter';
import { DRIZZLE } from '../common/ydb/ydb.constants.js';
import { DbUniqueViolationException } from '../common/exceptions/db-unique-violation.exception.js';
import { attempts } from './entities/attempt.schema.js';
import { users } from '../user/entities/user.schema.js';
import { trainingCamps } from '../training_camp/entities/training-camp.schema.js';
import {
  Attempt,
  CreateAttemptData,
  UpdateAttemptData,
} from './entities/attempt.types.js';

type DrizzleDb = ReturnType<
  typeof import('@ydbjs/drizzle-adapter').createDrizzle
>;

@Injectable()
export class AttemptYdbRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  //  CREATE (в транзакции с проверкой внешних связей)
  // ============================================================
  async create(data: CreateAttemptData): Promise<Attempt> {
    const id = uuidv4();

    return await this.db.transaction(async (tx) => {
      // 1. Проверяем существование пользователя
      const user = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, data.userId))
        .limit(1);

      if (!user || user.length === 0) {
        throw new Error(`User with id ${data.userId} not found`);
      }

      // 2. Проверяем существование тренировочного лагеря
      const camp = await tx
        .select({ id: trainingCamps.id })
        .from(trainingCamps)
        .where(eq(trainingCamps.id, data.trainingCampId))
        .limit(1);

      if (!camp || camp.length === 0) {
        throw new Error(
          `Training camp with id ${data.trainingCampId} not found`,
        );
      }

      // 3. Вставляем попытку
      const insertData = {
        id,
        userId: data.userId,
        testType: data.testType,
        attemptNumber: data.attemptNumber,
        testDate: data.testDate,
        trainingCampId: data.trainingCampId,
      };

      const result = (await tx.insert(attempts).values(insertData).returning({
        id: attempts.id,
        userId: attempts.userId,
        testType: attempts.testType,
        attemptNumber: attempts.attemptNumber,
        testDate: attempts.testDate,
        trainingCampId: attempts.trainingCampId,
      })) as Attempt[];

      const [attempt] = result;
      if (!attempt) throw new Error('Failed to create attempt');
      return attempt;
    });
  }

  // ============================================================
  //  UPDATE PARTIAL (в транзакции с проверкой внешних связей)
  // ============================================================
  async updatePartial(data: UpdateAttemptData): Promise<Attempt | null> {
    const { id, ...fields } = data;

    if (Object.keys(fields).length === 0) {
      return this.findById(id);
    }

    try {
      return await this.db.transaction(async (tx) => {
        // 1. Проверяем, что попытка существует
        const existing = await tx
          .select({ id: attempts.id })
          .from(attempts)
          .where(eq(attempts.id, id))
          .limit(1);

        if (!existing || existing.length === 0) {
          return null;
        }

        // 2. Если меняется user_id — проверяем пользователя
        if (fields.userId !== undefined) {
          const user = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, fields.userId))
            .limit(1);

          if (!user || user.length === 0) {
            throw new Error(`User with id ${fields.userId} not found`);
          }
        }

        // 3. Если меняется training_camp_id — проверяем лагерь
        if (fields.trainingCampId !== undefined) {
          const camp = await tx
            .select({ id: trainingCamps.id })
            .from(trainingCamps)
            .where(eq(trainingCamps.id, fields.trainingCampId))
            .limit(1);

          if (!camp || camp.length === 0) {
            throw new Error(
              `Training camp with id ${fields.trainingCampId} not found`,
            );
          }
        }

        // 4. Обновляем попытку
        const result = (await tx
          .update(attempts)
          .set(fields)
          .where(eq(attempts.id, id))
          .returning({
            id: attempts.id,
            userId: attempts.userId,
            testType: attempts.testType,
            attemptNumber: attempts.attemptNumber,
            testDate: attempts.testDate,
            trainingCampId: attempts.trainingCampId,
          })) as Attempt[];

        return result[0] || null;
      });
    } catch (error) {
      if (this.isDuplicateError(error)) {
        const conflictFields: { dbField: string; value: unknown }[] = [];
        if (fields.userId !== undefined) {
          conflictFields.push({ dbField: 'user_id', value: fields.userId });
        }
        if (fields.testType !== undefined) {
          conflictFields.push({ dbField: 'test_type', value: fields.testType });
        }
        if (fields.attemptNumber !== undefined) {
          conflictFields.push({
            dbField: 'attempt_number',
            value: fields.attemptNumber,
          });
        }
        if (fields.trainingCampId !== undefined) {
          conflictFields.push({
            dbField: 'training_camp_id',
            value: fields.trainingCampId,
          });
        }
        if (conflictFields.length === 0) {
          conflictFields.push(
            { dbField: 'user_id', value: undefined },
            { dbField: 'test_type', value: undefined },
            { dbField: 'attempt_number', value: undefined },
            { dbField: 'training_camp_id', value: undefined },
          );
        }
        throw new DbUniqueViolationException(
          conflictFields,
          'idx_unique_attempt',
        );
      }
      throw error;
    }
  }

  // ============================================================
  //  FIND BY ID (без транзакции)
  // ============================================================
  async findById(id: string): Promise<Attempt | null> {
    const result = (await this.db
      .select()
      .from(attempts)
      .where(eq(attempts.id, id))
      .limit(1)) as Attempt[];
    return result[0] || null;
  }

  // ============================================================
  //  FIND ALL (с пагинацией, фильтрацией, сортировкой)
  // ============================================================
  async findAll(
    limit = 100,
    offset = 0,
    filter?: { userId?: string; testType?: string; trainingCampId?: string },
    orderBy: 'test_date' | 'test_type' | 'attempt_number' = 'test_date',
    orderDir: 'ASC' | 'DESC' = 'DESC',
  ): Promise<{ rows: Attempt[]; total: number }> {
    const orderFieldMap = {
      test_date: attempts.testDate,
      test_type: attempts.testType,
      attempt_number: attempts.attemptNumber,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.userId) conditions.push(eq(attempts.userId, filter.userId));
    if (filter?.testType)
      conditions.push(eq(attempts.testType, filter.testType));
    if (filter?.trainingCampId)
      conditions.push(eq(attempts.trainingCampId, filter.trainingCampId));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = (await this.db
      .select()
      .from(attempts)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(attempts.id) : desc(attempts.id),
      )
      .limit(limit)
      .offset(offset)) as Attempt[];

    const countResult = (await this.db
      .select({ count: sql<number>`count(*)` })
      .from(attempts)
      .where(whereClause)) as { count: number }[];

    const [{ count }] = countResult;
    return { rows, total: Number(count ?? 0) };
  }

  // ============================================================
  //  DELETE (в транзакции)
  // ============================================================
  async delete(id: string): Promise<Attempt | null> {
    return await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: attempts.id })
        .from(attempts)
        .where(eq(attempts.id, id))
        .limit(1);

      if (!existing || existing.length === 0) {
        return null;
      }

      // Если есть связанные данные, удаляем их здесь
      // await tx.execute(sql`DELETE FROM attempt_details WHERE attempt_id = ${id}::uuid`);

      const result = await tx
        .delete(attempts)
        .where(eq(attempts.id, id))
        .returning({
          id: attempts.id,
          userId: attempts.userId,
          testType: attempts.testType,
          attemptNumber: attempts.attemptNumber,
          testDate: attempts.testDate,
          trainingCampId: attempts.trainingCampId,
        });

      return (result as Attempt[])[0] || null;
    });
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
