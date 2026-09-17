// src/test-types/repository/test-type.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, like, desc, asc, sql, SQL } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import { YdbUniqueConstraintViolationError } from '@ydbjs/drizzle-adapter';
import { DbUniqueViolationException } from '../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../common/exceptions/db-foreign-key-violation.exception.js';
import { DRIZZLE } from '../common/ydb/ydb.constants.js';
import { testTypes } from './entities/test-type.schema.js';
import { resultTestTypes } from '../result-test-types/entities/result-test-type.schema.js';
import {
  TestType,
  CreateTestTypeData,
  UpdateTestTypeData,
} from './entities/types/test-type.types.js';

type DrizzleDb = ReturnType<
  typeof import('@ydbjs/drizzle-adapter').createDrizzle
>;

/**
 * Набор полей для `.returning(...)`, чтобы не дублировать его
 * в create / updatePartial / delete.
 *
 * Если добавишь новое поле в схему — обнови только этот объект.
 */
const testTypeReturning = {
  id: testTypes.id,
  name: testTypes.name,
  gender: testTypes.gender,
  parameter: testTypes.parameter,
  failThresholdTime: testTypes.failThresholdTime,
  failThresholdLevel: testTypes.failThresholdLevel,
  failThresholdSegments: testTypes.failThresholdSegments,
  attemptsCount: testTypes.attemptsCount,
} as const;

/**
 * Для каждого поля типа `T[K]` возвращает `Exclude<T[K], null> | SQL`.
 * Используется, чтобы заменить JS-`null` на SQL-литерал `NULL`
 * (см. nullsToSql ниже).
 */
type SqlOrValue<T> = Exclude<T, null> | SQL;

/**
 * Заменяет `null`-значения в объекте на SQL-литерал `NULL`
 * (через sql-шаблон), оставляя остальные значения без изменений.
 *
 * Зачем это нужно:
 *   Драйвер YDB сериализует JS-`null` как protobuf `null_type`,
 *   который YDB не принимает в bind-параметрах:
 *     GENERIC_ERROR: Unsupported protobuf type: null_type: NULL_VALUE.
 *   Литерал `NULL`, вставленный через sql`NULL`, идёт в текст SQL,
 *   а не в `$pN`, и такой проблемы не вызывает.
 */
function nullsToSql<T extends object>(
  obj: T,
): { [K in keyof T]: SqlOrValue<T[K]> } {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value === null ? sql`NULL` : value;
  }
  return result as { [K in keyof T]: SqlOrValue<T[K]> };
}

@Injectable()
export class TestTypeRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  // CREATE
  //
  // `data` приходит из TestTypeMapper.toCreateData и содержит
  // ТОЛЬКО релевантные для данного parameter поля порогов:
  //   - time     → failThresholdTime + attemptsCount
  //   - segments → failThresholdSegments
  //   - level    → failThresholdLevel + failThresholdSegments
  //
  // Нерелевантные поля в объекте отсутствуют (не переданы как
  // null). Это критично для YDB: явный `null` в параметрах INSERT
  // драйвер сериализует как protobuf `null_type`, который YDB не
  // поддерживает — запрос падает с GENERIC_ERROR
  // ("Unsupported protobuf type: null_type: NULL_VALUE").
  //
  // Поэтому здесь:
  //   1. НЕ подставляем `?? null` для пороговых полей.
  //   2. Фильтруем undefined / null из финального объекта — на
  //      случай, если маппер всё же что-то положил.
  //
  // Отсутствующие в INSERT колонки YDB заполнит NULL по умолчанию,
  // уже без явного null-параметра.
  // ============================================================
  async create(data: CreateTestTypeData): Promise<TestType> {
    const id = uuidv4();

    const raw = {
      id,
      name: data.name,
      gender: data.gender,
      parameter: data.parameter,
      failThresholdTime: data.failThresholdTime,
      failThresholdLevel: data.failThresholdLevel,
      failThresholdSegments: data.failThresholdSegments,
      attemptsCount: data.attemptsCount,
    };

    // Убираем ключи со значением undefined и null — тогда Drizzle
    // не добавит эти колонки в INSERT, и YDB не получит бестиповый
    // null_type в параметрах.
    const insertData = Object.fromEntries(
      Object.entries(raw).filter(
        ([, value]) => value !== undefined && value !== null,
      ),
    );

    try {
      const result = (await this.db
        .insert(testTypes)
        .values(insertData)
        .returning(testTypeReturning)) as TestType[];

      const [record] = result;
      if (!record) throw new Error('Failed to create test type');
      return record;
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
  // FIND BY ID
  // ============================================================
  async findById(id: string): Promise<TestType | null> {
    const result = (await this.db
      .select()
      .from(testTypes)
      .where(eq(testTypes.id, id))
      .limit(1)) as TestType[];

    const [record] = result;
    return record || null;
  }

  // ============================================================
  // FIND BY NAME
  // ============================================================
  async findByName(name: string): Promise<TestType | null> {
    const result = (await this.db
      .select()
      .from(testTypes)
      .where(eq(testTypes.name, name))
      .limit(1)) as TestType[];

    const [record] = result;
    return record || null;
  }

  // ============================================================
  // FIND BY GENDER
  // ============================================================
  async findByGender(gender: string): Promise<TestType[]> {
    return (await this.db
      .select()
      .from(testTypes)
      .where(eq(testTypes.gender, gender))) as TestType[];
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // `fields` приходит из UpdateTestTypeData и уже содержит
  // только явно переданные поля (включая `parameter` и
  // `attemptsCount`, если их тронули — см. TestTypeMapper.toUpdateData).
  //
  // ⚠️ ВАЖНО ПРО YDB:
  //   Маппер выставляет `null` для обнуления старых порогов при
  //   смене типа теста (например, time → segments). Раньше эти
  //   `null` уходили в Drizzle как bind-параметры ($pN), и драйвер
  //   YDB сериализовал их в protobuf `null_type`, на который YDB
  //   отвечает:
  //     GENERIC_ERROR: Unsupported protobuf type: null_type: NULL_VALUE
  //
  //   Поэтому перед `.set(...)` прогоняем объект через nullsToSql:
  //   каждое `null`-значение превращается в SQL-литерал `NULL`
  //   через sql`NULL`. Литерал идёт в текст запроса, а не в
  //   параметры, и проблемы не вызывает.
  // ============================================================
  async updatePartial(data: UpdateTestTypeData): Promise<TestType | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    // null → sql`NULL`, всё остальное остаётся как было.
    const setData = nullsToSql(fields);

    try {
      const result = (await this.db
        .update(testTypes)
        .set(setData)
        .where(eq(testTypes.id, id))
        .returning(testTypeReturning)) as TestType[];

      const [record] = result;
      return record || null;
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
  // FIND ALL (пагинация, сортировка, фильтр)
  // ============================================================
  async findAll(
    limit = 100,
    offset = 0,
    filter?: { name?: string; gender?: string },
    orderBy: 'name' | 'id' | 'gender' = 'name',
    orderDir: 'ASC' | 'DESC' = 'ASC',
  ): Promise<{ rows: TestType[]; total: number }> {
    const orderFieldMap = {
      name: testTypes.name,
      id: testTypes.id,
      gender: testTypes.gender,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.name) {
      conditions.push(like(testTypes.name, `${filter.name}%`));
    }
    if (filter?.gender) {
      conditions.push(eq(testTypes.gender, filter.gender));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = (await this.db
      .select()
      .from(testTypes)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(testTypes.id) : desc(testTypes.id),
      )
      .limit(limit)
      .offset(offset)) as TestType[];

    const countResult = (await this.db
      .select({ count: sql<number>`count(*)` })
      .from(testTypes)
      .where(whereClause)) as { count: number }[];

    const [{ count }] = countResult;
    return { rows, total: Number(count ?? 0) };
  }

  // ============================================================
  // DELETE (возвращает удалённую запись или null)
  //
  // YDB не поддерживает FK-ограничения, поэтому проверяем ссылки
  // вручную через result_test_types. Если есть хотя бы одна связь,
  // удаление запрещаем.
  // ============================================================
  async delete(id: string): Promise<TestType | null> {
    return await this.db.transaction(async (tx) => {
      // 1. Находим запись по id
      const existing = (await tx
        .select()
        .from(testTypes)
        .where(eq(testTypes.id, id))
        .limit(1)) as TestType[];

      const record = existing[0];
      if (!record) return null;

      // 2. Проверяем наличие ссылок в result_test_types
      const existingRef = (await tx
        .select({ resultId: resultTestTypes.resultId })
        .from(resultTestTypes)
        .where(eq(resultTestTypes.testTypeId, record.id))
        .limit(1)) as { resultId: string }[];

      if (existingRef.length > 0) {
        throw new DbForeignKeyViolationException(
          [{ dbField: 'test_type_id', value: record.id }],
          'fk_result_test_types_test_type',
        );
      }

      // 3. Нет ссылок – удаляем и возвращаем удалённую запись
      const deleted = (await tx
        .delete(testTypes)
        .where(eq(testTypes.id, id))
        .returning(testTypeReturning)) as TestType[];

      return deleted[0] || null;
    });
  }

  // ============================================================
  // ОБРАБОТКА ОШИБОК УНИКАЛЬНОСТИ
  // ============================================================
  private isDuplicateError(error: unknown): boolean {
    if (error instanceof YdbUniqueConstraintViolationError) return true;
    if (error instanceof YDBError && (error.code as number) === 400120)
      return true;
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
