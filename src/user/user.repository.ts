// src/user/user.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, like, desc, asc, sql } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import { YdbUniqueConstraintViolationError } from '@ydbjs/drizzle-adapter';
import { users } from './entities/user.schema.js';
import { User, CreateUserData, UpdateUserData } from './entities/user.types.js';
import { DbUniqueViolationException } from '../common/exceptions/db-unique-violation.exception.js';
import { DRIZZLE } from '../common/ydb/ydb.constants.js';

type DrizzleDb = ReturnType<
  typeof import('@ydbjs/drizzle-adapter').createDrizzle
>;

@Injectable()
export class UserYdbRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  //  CREATE
  // ============================================================
  async createUser(data: CreateUserData): Promise<User> {
    const id = uuidv4();

    const raw = {
      id,
      ...data,
      isActive: data.isActive ?? false,
    };

    // Удаляем ключи со значением undefined
    const insertData = Object.fromEntries(
      Object.entries(raw).filter(([_, value]) => value !== undefined),
    );

    try {
      const result = (await this.db.insert(users).values(insertData).returning({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        birthDate: users.birthDate,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })) as User[];

      const [user] = result;
      if (!user) throw new Error('Failed to create user');
      return user;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'email', value: data.email },
        ]);
      }
      throw error;
    }
  }

  // ============================================================
  //  FIND
  // ============================================================
  async findById(id: string): Promise<User | null> {
    const result = (await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)) as User[];
    const [user] = result;
    return user || null;
  }

  async findByEmailWithPasswordHash(email: string): Promise<User | null> {
    const result = (await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)) as User[];
    const [user] = result;
    return user || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findByEmailWithPasswordHash(email);
  }

  // ============================================================
  //  UPDATE PARTIAL (PATCH)
  // ============================================================
  async updatePartial(data: UpdateUserData): Promise<User | null> {
    const { id, ...fields } = data;
    const now = new Date();

    // Drizzle игнорирует поля со значением undefined
    // null передаётся как литерал NULL в SQL (работает для YDB)
    const setData = { ...fields, updatedAt: now };

    // Если только updatedAt – нечего обновлять, возвращаем текущую запись
    if (Object.keys(setData).length === 1) {
      return this.findById(id);
    }

    try {
      const result = (await this.db
        .update(users)
        .set(setData)
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          birthDate: users.birthDate,
          passwordHash: users.passwordHash,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })) as User[];

      const [user] = result;
      return user || null;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'email', value: data.email },
        ]);
      }
      throw error;
    }
  }

  // ============================================================
  //  UPDATE FULL (PUT)
  // ============================================================
  async update(entity: User): Promise<User | null> {
    const now = new Date();

    const fields: Omit<User, 'id' | 'createdAt' | 'updatedAt'> = {
      firstName: entity.firstName,
      lastName: entity.lastName,
      email: entity.email,
      birthDate: entity.birthDate,
      passwordHash: entity.passwordHash,
      isActive: entity.isActive,
    };

    // Поля со значением null преобразуются в NULL в SQL
    const setData = { ...fields, updatedAt: now };

    if (Object.keys(setData).length === 1) {
      return this.findById(entity.id);
    }

    try {
      const result = (await this.db
        .update(users)
        .set(setData)
        .where(eq(users.id, entity.id))
        .returning({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          birthDate: users.birthDate,
          passwordHash: users.passwordHash,
          isActive: users.isActive,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })) as User[];

      const [user] = result;
      return user || null;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'email', value: entity.email },
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
    filter?: { email?: string; firstName?: string; lastName?: string },
    orderBy: 'created_at' | 'first_name' | 'last_name' | 'email' = 'created_at',
    orderDir: 'ASC' | 'DESC' = 'DESC',
  ): Promise<{ rows: User[]; total: number }> {
    const orderFieldMap = {
      created_at: users.createdAt,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.email) conditions.push(like(users.email, `${filter.email}%`));
    if (filter?.firstName)
      conditions.push(like(users.firstName, `${filter.firstName}%`));
    if (filter?.lastName)
      conditions.push(like(users.lastName, `${filter.lastName}%`));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = (await this.db
      .select()
      .from(users)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(users.id) : desc(users.id),
      )
      .limit(limit)
      .offset(offset)) as User[];

    const countResult = (await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(whereClause)) as { count: number }[];
    const [{ count }] = countResult;

    return { rows, total: Number(count ?? 0) };
  }

  // ============================================================
  //  DELETE
  // ============================================================
  async remove(id: string): Promise<User | null> {
    return await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        DELETE FROM users_lists
        WHERE user_id = ${id}::uuid
      `);

      const result = await tx.delete(users).where(eq(users.id, id)).returning({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        birthDate: users.birthDate,
        passwordHash: users.passwordHash,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

      const [user] = result as User[];
      return user || null;
    });
  }

  // ============================================================
  //  Обработка ошибок
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
