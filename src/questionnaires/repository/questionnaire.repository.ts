// src/questionnaires/repository/questionnaire.repository.ts

import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, inArray, sql, asc } from 'drizzle-orm';
import type { YdbDrizzleDatabase } from '@ydbjs/drizzle-adapter';
import { YdbUniqueConstraintViolationError } from '@ydbjs/drizzle-adapter';
import { YDBError } from '@ydbjs/error';
import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { questionnaires } from '../entities/questionnaire.schema.js';
import { users } from '../../user/entities/user.schema.js';
import { usersLists } from '../../user-list/users-lists.schema.js';
import {
  Questionnaire,
  CreateQuestionnaireData,
  UpdateQuestionnaireData,
  QuestionnaireWithUser,
} from '../entities/types/questionnaire.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;

@Injectable()
export class QuestionnaireRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  // UPSERT (одиночный) – создаёт или обновляет анкету по userId
  // ============================================================
  async upsert(data: CreateQuestionnaireData): Promise<Questionnaire> {
    try {
      const result = (await this.db
        .upsert(questionnaires)
        .values(data)
        .returning({
          userId: questionnaires.userId,
          sportsCategory: questionnaires.sportsCategory,
          orderNumber: questionnaires.orderNumber,
          assignmentDate: questionnaires.assignmentDate,
          assigningAuthority: questionnaires.assigningAuthority,
          isFifaJudge: questionnaires.isFifaJudge,
          fifaId: questionnaires.fifaId,
          hasVarLicense: questionnaires.hasVarLicense,
          heightCm: questionnaires.heightCm,
          jogelEquipmentSize: questionnaires.jogelEquipmentSize,
          jogelShoeSize: questionnaires.jogelShoeSize,
          citizenship: questionnaires.citizenship,
          countryOfResidence: questionnaires.countryOfResidence,
          passportType: questionnaires.passportType,
          passportSeries: questionnaires.passportSeries,
          passportNumber: questionnaires.passportNumber,
          issuedBy: questionnaires.issuedBy,
          issueDate: questionnaires.issueDate,
          departmentCode: questionnaires.departmentCode,
          phone: questionnaires.phone,
        })) as Questionnaire[];

      const [record] = result;
      if (!record) throw new Error('Failed to upsert questionnaire');
      return record;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'user_id', value: data.userId },
        ]);
      }
      throw error;
    }
  }

  // ============================================================
  // UPSERT MANY (массовый) – создаёт или обновляет множество анкет
  // ============================================================
  async upsertMany(data: CreateQuestionnaireData[]): Promise<Questionnaire[]> {
    if (data.length === 0) return [];

    try {
      const result = (await this.db
        .upsert(questionnaires)
        .values(data)
        .returning({
          userId: questionnaires.userId,
          sportsCategory: questionnaires.sportsCategory,
          orderNumber: questionnaires.orderNumber,
          assignmentDate: questionnaires.assignmentDate,
          assigningAuthority: questionnaires.assigningAuthority,
          isFifaJudge: questionnaires.isFifaJudge,
          fifaId: questionnaires.fifaId,
          hasVarLicense: questionnaires.hasVarLicense,
          heightCm: questionnaires.heightCm,
          jogelEquipmentSize: questionnaires.jogelEquipmentSize,
          jogelShoeSize: questionnaires.jogelShoeSize,
          citizenship: questionnaires.citizenship,
          countryOfResidence: questionnaires.countryOfResidence,
          passportType: questionnaires.passportType,
          passportSeries: questionnaires.passportSeries,
          passportNumber: questionnaires.passportNumber,
          issuedBy: questionnaires.issuedBy,
          issueDate: questionnaires.issueDate,
          departmentCode: questionnaires.departmentCode,
          phone: questionnaires.phone,
        })) as Questionnaire[];

      return result;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'user_id', value: 'one or more userIds' },
        ]);
      }
      throw error;
    }
  }

  // ============================================================
  // CREATE BY EMAIL (одиночный) – находит пользователя по email и выполняет upsert
  // ============================================================
  async createByEmail(
    email: string,
    data: Omit<CreateQuestionnaireData, 'userId'>,
  ): Promise<Questionnaire> {
    const user = (await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)) as { id: string }[];

    if (!user.length) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const userId = user[0].id;
    return this.upsert({ ...data, userId });
  }

  // ============================================================
  // CREATE MANY BY EMAIL – массовый upsert по email
  // ============================================================
  async createManyByEmail(
    items: Array<{ email: string } & Omit<CreateQuestionnaireData, 'userId'>>,
  ): Promise<Questionnaire[]> {
    if (items.length === 0) return [];

    const emails = items.map((item) => item.email);

    const usersFound = (await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, emails))) as { id: string; email: string }[];

    if (!usersFound.length) {
      throw new NotFoundException(`No users found for provided emails`);
    }

    const emailToUserId = new Map(usersFound.map((u) => [u.email, u.id]));

    const missingEmails = emails.filter((email) => !emailToUserId.has(email));
    if (missingEmails.length) {
      throw new NotFoundException(
        `Users with emails ${missingEmails.join(', ')} not found`,
      );
    }

    // 🔥 Исключаем email из данных для вставки
    const createData = items.map((item) => {
      const { email, ...rest } = item;
      return {
        ...rest,
        userId: emailToUserId.get(email) as string,
      };
    });

    return this.upsertMany(createData);
  }

  // ============================================================
  // FIND BY USER ID
  // ============================================================
  async findByUserId(userId: string): Promise<Questionnaire | null> {
    const result = (await this.db
      .select()
      .from(questionnaires)
      .where(eq(questionnaires.userId, userId))
      .limit(1)) as Questionnaire[];
    return result[0] || null;
  }

  // ============================================================
  // FIND WITH USER DATA BY USER ID
  // ============================================================
  async findWithUserByUserId(
    userId: string,
  ): Promise<QuestionnaireWithUser | null> {
    const rows = (await this.db
      .select({
        userId: questionnaires.userId,
        sportsCategory: questionnaires.sportsCategory,
        orderNumber: questionnaires.orderNumber,
        assignmentDate: questionnaires.assignmentDate,
        assigningAuthority: questionnaires.assigningAuthority,
        isFifaJudge: questionnaires.isFifaJudge,
        fifaId: questionnaires.fifaId,
        hasVarLicense: questionnaires.hasVarLicense,
        heightCm: questionnaires.heightCm,
        jogelEquipmentSize: questionnaires.jogelEquipmentSize,
        jogelShoeSize: questionnaires.jogelShoeSize,
        citizenship: questionnaires.citizenship,
        countryOfResidence: questionnaires.countryOfResidence,
        passportType: questionnaires.passportType,
        passportSeries: questionnaires.passportSeries,
        passportNumber: questionnaires.passportNumber,
        issuedBy: questionnaires.issuedBy,
        issueDate: questionnaires.issueDate,
        departmentCode: questionnaires.departmentCode,
        phone: questionnaires.phone,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(questionnaires)
      .leftJoin(users, eq(questionnaires.userId, users.id))
      .where(eq(questionnaires.userId, userId))
      .limit(1)) as QuestionnaireWithUser[];

    return rows[0] || null;
  }

  // ============================================================
  // UPDATE (частичное) – обновляет только переданные поля
  // ============================================================
  async update(
    userId: string,
    data: UpdateQuestionnaireData,
  ): Promise<Questionnaire | null> {
    const { userId: _, ...fields } = data;
    if (Object.keys(fields).length === 0) {
      return this.findByUserId(userId);
    }

    try {
      const result = (await this.db
        .update(questionnaires)
        .set(fields)
        .where(eq(questionnaires.userId, userId))
        .returning({
          userId: questionnaires.userId,
          sportsCategory: questionnaires.sportsCategory,
          orderNumber: questionnaires.orderNumber,
          assignmentDate: questionnaires.assignmentDate,
          assigningAuthority: questionnaires.assigningAuthority,
          isFifaJudge: questionnaires.isFifaJudge,
          fifaId: questionnaires.fifaId,
          hasVarLicense: questionnaires.hasVarLicense,
          heightCm: questionnaires.heightCm,
          jogelEquipmentSize: questionnaires.jogelEquipmentSize,
          jogelShoeSize: questionnaires.jogelShoeSize,
          citizenship: questionnaires.citizenship,
          countryOfResidence: questionnaires.countryOfResidence,
          passportType: questionnaires.passportType,
          passportSeries: questionnaires.passportSeries,
          passportNumber: questionnaires.passportNumber,
          issuedBy: questionnaires.issuedBy,
          issueDate: questionnaires.issueDate,
          departmentCode: questionnaires.departmentCode,
          phone: questionnaires.phone,
        })) as Questionnaire[];

      return result[0] || null;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'user_id', value: userId },
        ]);
      }
      throw error;
    }
  }

  // ============================================================
  // DELETE
  // ============================================================
  async delete(userId: string): Promise<Questionnaire | null> {
    const result = (await this.db
      .delete(questionnaires)
      .where(eq(questionnaires.userId, userId))
      .returning({
        userId: questionnaires.userId,
        sportsCategory: questionnaires.sportsCategory,
        orderNumber: questionnaires.orderNumber,
        assignmentDate: questionnaires.assignmentDate,
        assigningAuthority: questionnaires.assigningAuthority,
        isFifaJudge: questionnaires.isFifaJudge,
        fifaId: questionnaires.fifaId,
        hasVarLicense: questionnaires.hasVarLicense,
        heightCm: questionnaires.heightCm,
        jogelEquipmentSize: questionnaires.jogelEquipmentSize,
        jogelShoeSize: questionnaires.jogelShoeSize,
        citizenship: questionnaires.citizenship,
        countryOfResidence: questionnaires.countryOfResidence,
        passportType: questionnaires.passportType,
        passportSeries: questionnaires.passportSeries,
        passportNumber: questionnaires.passportNumber,
        issuedBy: questionnaires.issuedBy,
        issueDate: questionnaires.issueDate,
        departmentCode: questionnaires.departmentCode,
        phone: questionnaires.phone,
      })) as Questionnaire[];

    return result[0] || null;
  }

  // ============================================================
  // FIND ALL (с пагинацией, фильтрацией по спискам и пользователям, JOIN с users)
  // ============================================================
  async findAll(params: {
    limit?: number;
    offset?: number;
    listIds?: string[];
    userIds?: string[];
  }): Promise<{ rows: QuestionnaireWithUser[]; total: number }> {
    const { limit = 100, offset = 0, listIds, userIds } = params;

    const conditions = [];

    if (userIds && userIds.length > 0) {
      conditions.push(inArray(questionnaires.userId, userIds));
    }

    if (listIds && listIds.length > 0) {
      const subQuery = this.db
        .select({ userId: usersLists.userId })
        .from(usersLists)
        .where(inArray(usersLists.listId, listIds));

      conditions.push(inArray(questionnaires.userId, subQuery));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    let query = this.db
      .select({
        userId: questionnaires.userId,
        sportsCategory: questionnaires.sportsCategory,
        orderNumber: questionnaires.orderNumber,
        assignmentDate: questionnaires.assignmentDate,
        assigningAuthority: questionnaires.assigningAuthority,
        isFifaJudge: questionnaires.isFifaJudge,
        fifaId: questionnaires.fifaId,
        hasVarLicense: questionnaires.hasVarLicense,
        heightCm: questionnaires.heightCm,
        jogelEquipmentSize: questionnaires.jogelEquipmentSize,
        jogelShoeSize: questionnaires.jogelShoeSize,
        citizenship: questionnaires.citizenship,
        countryOfResidence: questionnaires.countryOfResidence,
        passportType: questionnaires.passportType,
        passportSeries: questionnaires.passportSeries,
        passportNumber: questionnaires.passportNumber,
        issuedBy: questionnaires.issuedBy,
        issueDate: questionnaires.issueDate,
        departmentCode: questionnaires.departmentCode,
        phone: questionnaires.phone,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(questionnaires)
      .leftJoin(users, eq(questionnaires.userId, users.id));

    if (whereClause) {
      query = query.where(whereClause);
    }

    query = query.orderBy(asc(questionnaires.userId));

    const rows = (await query
      .limit(limit)
      .offset(offset)) as QuestionnaireWithUser[];

    let countQuery = this.db
      .select({ count: sql<number>`count(*)` })
      .from(questionnaires)
      .leftJoin(users, eq(questionnaires.userId, users.id));

    if (whereClause) {
      countQuery = countQuery.where(whereClause);
    }

    const countResult = (await countQuery) as { count: number }[];
    const total = Number(countResult[0]?.count ?? 0);

    return { rows, total };
  }

  // ============================================================
  // ОБРАБОТКА ОШИБОК УНИКАЛЬНОСТИ
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
