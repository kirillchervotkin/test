// src/teams/repository/team.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, like, asc, desc, sql, SQL } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { teams } from '../entities/team.schema.js';
import { cities } from '../../city/entities/city.schema.js';
import {
  Team,
  CreateTeamData,
  UpdateTeamData,
  TeamFilters,
} from '../entities/types/team.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../../common/exceptions/db-foreign-key-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;
type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];
type DrizzleRunner = DrizzleDb | DrizzleTx;

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
export class TeamRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  /**
   * Набор полей для `.returning(...)`, чтобы не дублировать его
   * в create / update / delete.
   */
  private readonly selectShape = {
    id: teams.id,
    name: teams.name,
    shortName: teams.shortName,
    cityId: teams.cityId,
  } as const;

  // ============================================================
  // INTERNAL HELPERS
  //
  // Принимают runner (db или tx) — это часть внутренней
  // транзакционной логики. В публичный API не выходят.
  // ============================================================

  /**
   * Проверяет существование города (если cityId задан).
   *
   * YDB не enforced FK, поэтому единственный способ поймать
   * нарушение — самим убедиться, что родитель есть.
   * Вызывается строго внутри транзакции, в одном снапшоте с записью.
   *
   * Благодаря SERIALIZABLE-изоляции YDB и оптимистичным блокировкам,
   * если параллельная транзакция удалит city между нашим SELECT
   * и INSERT/UPDATE, конфликт будет обнаружен на коммите, и одна
   * из транзакций будет прервана с retryable-ошибкой. При
   * idempotent: true адаптер автоматически перезапустит транзакцию.
   */
  private async ensureCityExists(
    cityId: string,
    runner: DrizzleRunner,
  ): Promise<void> {
    const rows = (await runner
      .select({ id: cities.id })
      .from(cities)
      .where(eq(cities.id, cityId))
      .limit(1)) as { id: string }[];

    if (rows.length === 0) {
      throw new DbForeignKeyViolationException([
        { dbField: 'city_id', value: cityId },
      ]);
    }
  }

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
  // Всегда в транзакции: ensureCityExists + insert должны быть
  // в одном снапшоте. Иначе возможна гонка — параллельная
  // транзакция удалит город между проверкой и вставкой.
  //
  // `cityId` опционален: команда может быть без домашнего города
  // (например, сборная). Если не передан — проверка не выполняется.
  // ============================================================
  async create(data: CreateTeamData): Promise<Team> {
    const id = uuidv4();

    const execute = async (runner: DrizzleRunner): Promise<Team> => {
      // 1. Проверка FK — ВНУТРИ транзакции, если cityId задан.
      if (data.cityId) {
        await this.ensureCityExists(data.cityId, runner);
      }

      // 2. INSERT
      const raw = {
        id,
        name: data.name,
        shortName: data.shortName,
        cityId: data.cityId,
      };

      // Отсеиваем null/undefined — YDB заполнит отсутствующие
      // колонки NULL без явного null-параметра.
      const insertData = Object.fromEntries(
        Object.entries(raw).filter(
          ([, value]) => value !== undefined && value !== null,
        ),
      );

      try {
        const rows = (await runner
          .insert(teams)
          .values(insertData)
          .returning(this.selectShape)) as Team[];

        const [newRow] = rows;
        if (!newRow) throw new Error('Failed to create team');
        return newRow;
      } catch (err) {
        if (this.isDuplicateError(err)) {
          throw new DbUniqueViolationException([
            { dbField: 'name', value: data.name },
          ]);
        }
        throw err;
      }
    };

    return this.db.transaction(execute, { idempotent: true });
  }

  // ============================================================
  // FIND BY ID
  // ============================================================
  async findById(id: string): Promise<Team | null> {
    const rows = (await this.db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1)) as Team[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND BY NAME
  // Точное совпадение по имени. Используется для проверки
  // дубликатов на уровне сервиса, если понадобится.
  // ============================================================
  async findByName(name: string): Promise<Team | null> {
    const rows = (await this.db
      .select()
      .from(teams)
      .where(eq(teams.name, name))
      .limit(1)) as Team[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND BY CITY
  // Все команды с указанным домашним городом.
  // ============================================================
  async findByCity(cityId: string): Promise<Team[]> {
    return (await this.db
      .select()
      .from(teams)
      .where(eq(teams.cityId, cityId))
      .orderBy(asc(teams.name))) as Team[];
  }

  // ============================================================
  // SEARCH BY NAME
  // Частичное совпадение (LIKE %query%) для автокомплита.
  // Ищет и по полному, и по короткому имени.
  // ============================================================
  async searchByName(query: string): Promise<Team[]> {
    return (await this.db
      .select()
      .from(teams)
      .where(like(teams.name, `%${query}%`))
      .orderBy(asc(teams.name))) as Team[];
  }

  // ============================================================
  // FIND ALL (фильтры + сортировка, без пагинации)
  //
  // Команд в системе сотни максимум (не тысячи), пагинация
  // не нужна. Отдаём всё сразу с фильтрами и сортировкой.
  // ============================================================
  async findAll(
    filter?: TeamFilters,
    orderBy: 'name' | 'shortName' = 'name',
    orderDir: 'ASC' | 'DESC' = 'ASC',
  ): Promise<Team[]> {
    const orderFieldMap = {
      name: teams.name,
      shortName: teams.shortName,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.name) {
      conditions.push(like(teams.name, `%${filter.name}%`));
    }
    if (filter?.shortName) {
      conditions.push(like(teams.shortName, `%${filter.shortName}%`));
    }
    if (filter?.cityId) {
      conditions.push(eq(teams.cityId, filter.cityId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    return (await this.db
      .select()
      .from(teams)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(teams.id) : desc(teams.id),
      )) as Team[];
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Всегда в транзакции: если меняется cityId — сначала проверяем,
  // что новый город существует, потом пишем. Проверка и запись
  // в одном снапшоте — защита от гонки с удалением города.
  //
  // nullsToSql превращает явные null в SQL-литералы NULL:
  //   PATCH { shortName: null } → «убрать короткое имя».
  //   PATCH { cityId: null }    → «убрать домашний город».
  // ============================================================
  async updatePartial(data: UpdateTeamData): Promise<Team | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    const execute = async (runner: DrizzleRunner): Promise<Team | null> => {
      // Если cityId явно задан (не null, не undefined) —
      // проверяем, что город существует.
      if (fields.cityId !== undefined && fields.cityId !== null) {
        await this.ensureCityExists(fields.cityId, runner);
      }

      const setData = nullsToSql(fields);

      try {
        const rows = (await runner
          .update(teams)
          .set(setData)
          .where(eq(teams.id, id))
          .returning(this.selectShape)) as Team[];
        return rows[0] ?? null;
      } catch (err) {
        if (this.isDuplicateError(err)) {
          throw new DbUniqueViolationException([
            { dbField: 'name', value: fields.name },
          ]);
        }
        throw err;
      }
    };

    return this.db.transaction(execute, { idempotent: true });
  }

  // ============================================================
  // DELETE
  //
  // Ссылки на команду в matches (home_team_id, away_team_id)
  // проверяются на уровне сервисного слоя при появлении
  // MatchRepository. Здесь — простое удаление.
  // ============================================================
  async delete(id: string): Promise<Team | null> {
    const rows = (await this.db
      .delete(teams)
      .where(eq(teams.id, id))
      .returning(this.selectShape)) as Team[];
    return rows[0] ?? null;
  }
}
