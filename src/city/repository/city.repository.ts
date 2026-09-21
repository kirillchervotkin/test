// src/cities/repository/city.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, like, asc, desc, sql, SQL } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { cities } from '../entities/city.schema.js';
import {
  City,
  CreateCityData,
  UpdateCityData,
  CityFilters,
} from '../entities/types/city.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;

/**
 * Для каждого поля типа `T[K]` возвращает `Exclude<T[K], null> | SQL`.
 * Используется, чтобы заменить JS-`null` на SQL-литерал `NULL`.
 */
type SqlOrValue<T> = Exclude<T, null> | SQL;

/**
 * Заменяет `null`-значения в объекте на SQL-литерал `NULL`
 * через sql`NULL`, оставляя остальные значения без изменений.
 *
 * Зачем это нужно: драйвер YDB сериализует JS-`null` как protobuf
 * `null_type`, который YDB не принимает в bind-параметрах:
 *   GENERIC_ERROR: Unsupported protobuf type: null_type: NULL_VALUE.
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

const YDB_UNIQUE_VIOLATION_CODE = 400120;

@Injectable()
export class CityRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  /**
   * Набор полей для `.returning(...)`, чтобы не дублировать его
   * в create / update / delete.
   */
  private readonly selectShape = {
    id: cities.id,
    name: cities.name,
    region: cities.region,
    createdAt: cities.createdAt,
    updatedAt: cities.updatedAt,
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
  // На create-пути `null` и `undefined` для `region` трактуются
  // одинаково — «не передано». Поле не попадает в INSERT, YDB
  // подставляет NULL по умолчанию, без явного null_type.
  // ============================================================
  async create(data: CreateCityData): Promise<City> {
    const id = uuidv4();
    const now = new Date();

    const raw = {
      id,
      name: data.name,
      region: data.region,
      createdAt: now,
      updatedAt: now,
    };

    // Отсеиваем null/undefined — YDB заполнит отсутствующие
    // колонки NULL без явного null-параметра.
    const insertData = Object.fromEntries(
      Object.entries(raw).filter(
        ([, value]) => value !== undefined && value !== null,
      ),
    );

    try {
      const rows = (await this.db
        .insert(cities)
        .values(insertData)
        .returning(this.selectShape)) as City[];

      const [newRow] = rows;
      if (!newRow) throw new Error('Failed to create city');
      return newRow;
    } catch (err) {
      if (this.isDuplicateError(err)) {
        throw new DbUniqueViolationException([
          { dbField: 'name', value: data.name },
        ]);
      }
      throw err;
    }
  }

  // ============================================================
  // FIND BY ID
  // ============================================================
  async findById(id: string): Promise<City | null> {
    const rows = (await this.db
      .select()
      .from(cities)
      .where(eq(cities.id, id))
      .limit(1)) as City[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND BY NAME
  // Точное совпадение по имени. Используется для проверки
  // дубликатов на уровне сервиса, если понадобится.
  // ============================================================
  async findByName(name: string): Promise<City | null> {
    const rows = (await this.db
      .select()
      .from(cities)
      .where(eq(cities.name, name))
      .limit(1)) as City[];
    return rows[0] ?? null;
  }

  // ============================================================
  // SEARCH BY NAME
  // Частичное совпадение (LIKE %query%) для автокомплита.
  // ============================================================
  async searchByName(query: string): Promise<City[]> {
    return (await this.db
      .select()
      .from(cities)
      .where(like(cities.name, `%${query}%`))
      .orderBy(asc(cities.name))) as City[];
  }

  // ============================================================
  // FIND ALL (фильтры + сортировка)
  // ============================================================
  async findAll(
    filter?: CityFilters,
    orderBy: 'name' | 'region' | 'createdAt' = 'name',
    orderDir: 'ASC' | 'DESC' = 'ASC',
  ): Promise<City[]> {
    const orderFieldMap = {
      name: cities.name,
      region: cities.region,
      createdAt: cities.createdAt,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.name) {
      conditions.push(like(cities.name, `%${filter.name}%`));
    }
    if (filter?.region) {
      conditions.push(eq(cities.region, filter.region));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    return (await this.db
      .select()
      .from(cities)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(cities.id) : desc(cities.id),
      )) as City[];
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // nullsToSql превращает явные null в SQL-литералы NULL:
  //   PATCH { region: null } → «очистить регион».
  // ============================================================
  async updatePartial(data: UpdateCityData): Promise<City | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    const setData = nullsToSql({
      ...fields,
      updatedAt: new Date(),
    });

    try {
      const rows = (await this.db
        .update(cities)
        .set(setData)
        .where(eq(cities.id, id))
        .returning(this.selectShape)) as City[];
      return rows[0] ?? null;
    } catch (err) {
      if (this.isDuplicateError(err)) {
        throw new DbUniqueViolationException([
          { dbField: 'name', value: fields.name },
        ]);
      }
      throw err;
    }
  }

  // ============================================================
  // DELETE
  //
  // Ссылки на город в matches (city_id, NOT NULL) проверяются
  // на уровне сервисного слоя при появлении MatchRepository.
  // Здесь — простое удаление.
  // ============================================================
  async delete(id: string): Promise<City | null> {
    const rows = (await this.db
      .delete(cities)
      .where(eq(cities.id, id))
      .returning(this.selectShape)) as City[];
    return rows[0] ?? null;
  }
}
