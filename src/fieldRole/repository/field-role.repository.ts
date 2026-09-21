// src/field-roles/repository/field-role.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, like, asc, desc } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { fieldRoles } from '../entities/field-role.schema.js';
import {
  FieldRole,
  CreateFieldRoleData,
  UpdateFieldRoleData,
  FieldRoleFilters,
} from '../entities/types/field-role.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;

const YDB_UNIQUE_VIOLATION_CODE = 400120;

@Injectable()
export class FieldRoleRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  /**
   * Набор полей для `.returning(...)`, чтобы не дублировать его
   * в create / update / delete.
   */
  private readonly selectShape = {
    id: fieldRoles.id,
    code: fieldRoles.code,
    name: fieldRoles.name,
    sortOrder: fieldRoles.sortOrder,
  } as const;

  // ============================================================
  // ERROR DETECTION
  // ============================================================
  private isDuplicateError(error: unknown): boolean {
    if (error instanceof YdbUniqueConstraintViolationError) return true;

    if (
      error instanceof YDBError &&
      (error.code as number) === YDB_UNIQUE_VIOLATION_CODE
    ) {
      return true;
    }

    if (
      error instanceof Error &&
      'cause' in error &&
      error.cause instanceof YDBError &&
      (error.cause.code as number) === YDB_UNIQUE_VIOLATION_CODE
    ) {
      return true;
    }

    return false;
  }

  // ============================================================
  // CREATE
  //
  // Все поля обязательны, nullable-полей нет. Транзакция не нужна:
  // нет FK-проверок, нет связанных записей. Один INSERT.
  //
  // Если code уже существует — DbUniqueViolationException (409).
  // ============================================================
  async create(data: CreateFieldRoleData): Promise<FieldRole> {
    const id = uuidv4();

    try {
      const rows = (await this.db
        .insert(fieldRoles)
        .values({
          id,
          code: data.code,
          name: data.name,
          sortOrder: data.sortOrder,
        })
        .returning(this.selectShape)) as FieldRole[];

      const [newRow] = rows;
      if (!newRow) throw new Error('Failed to create field role');
      return newRow;
    } catch (err) {
      if (this.isDuplicateError(err)) {
        throw new DbUniqueViolationException([
          { dbField: 'code', value: data.code },
        ]);
      }
      throw err;
    }
  }

  // ============================================================
  // FIND BY ID
  // ============================================================
  async findById(id: string): Promise<FieldRole | null> {
    const rows = (await this.db
      .select()
      .from(fieldRoles)
      .where(eq(fieldRoles.id, id))
      .limit(1)) as FieldRole[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND BY CODE
  //
  // Точное совпадение по коду. Используется в бизнес-логике
  // (например, «найти REFEREE»), а также для проверки дубликатов
  // в сервисе, если понадобится.
  // ============================================================
  async findByCode(code: string): Promise<FieldRole | null> {
    const rows = (await this.db
      .select()
      .from(fieldRoles)
      .where(eq(fieldRoles.code, code))
      .limit(1)) as FieldRole[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND ALL (фильтры + сортировка, без пагинации)
  //
  // По умолчанию сортировка по sortOrder — естественный порядок
  // отображения в UI (Главный судья, Помощник, ...).
  //
  // Пагинации нет: ролей фиксированное количество (5).
  // ============================================================
  async findAll(
    filter?: FieldRoleFilters,
    orderBy: 'sortOrder' | 'code' | 'name' = 'sortOrder',
    orderDir: 'ASC' | 'DESC' = 'ASC',
  ): Promise<FieldRole[]> {
    const orderFieldMap = {
      sortOrder: fieldRoles.sortOrder,
      code: fieldRoles.code,
      name: fieldRoles.name,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.code) {
      conditions.push(eq(fieldRoles.code, filter.code));
    }
    if (filter?.name) {
      conditions.push(like(fieldRoles.name, `%${filter.name}%`));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    return (await this.db
      .select()
      .from(fieldRoles)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(fieldRoles.id) : desc(fieldRoles.id),
      )) as FieldRole[];
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Все поля кроме `id` — опциональны. `null` не допускается:
  // у роли нет nullable-полей. nullsToSql не нужен — только
  // явные значения.
  //
  // Если меняется `code` и он уже занят — DbUniqueViolationException.
  // ============================================================
  async updatePartial(data: UpdateFieldRoleData): Promise<FieldRole | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    try {
      const rows = (await this.db
        .update(fieldRoles)
        .set(fields)
        .where(eq(fieldRoles.id, id))
        .returning(this.selectShape)) as FieldRole[];
      return rows[0] ?? null;
    } catch (err) {
      if (this.isDuplicateError(err)) {
        throw new DbUniqueViolationException([
          { dbField: 'code', value: fields.code },
        ]);
      }
      throw err;
    }
  }

  // ============================================================
  // DELETE
  //
  // Ссылки на роль в assignments проверяются на уровне сервисного
  // слоя при появлении AssignmentRepository. Здесь — простое
  // удаление.
  // ============================================================
  async delete(id: string): Promise<FieldRole | null> {
    const rows = (await this.db
      .delete(fieldRoles)
      .where(eq(fieldRoles.id, id))
      .returning(this.selectShape)) as FieldRole[];
    return rows[0] ?? null;
  }
}
