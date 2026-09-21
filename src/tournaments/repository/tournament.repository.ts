// src/tournaments/repository/tournament.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, like, desc, asc, sql, SQL } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import { YdbUniqueConstraintViolationError } from '@ydbjs/drizzle-adapter';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../../common/exceptions/db-foreign-key-violation.exception.js';
import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { tournaments } from '../entities/tournament.schema.js';
import { stages } from '../../stages/entities/stage.schema.js';
import {
  Tournament,
  CreateTournamentData,
  UpdateTournamentData,
  TournamentFilters,
} from '../entities/types/tournament.types.js';

type DrizzleDb = ReturnType<
  typeof import('@ydbjs/drizzle-adapter').createDrizzle
>;

const tournamentReturning = {
  id: tournaments.id,
  name: tournaments.name,
  season: tournaments.season,
  type: tournaments.type,
  startDate: tournaments.startDate,
  endDate: tournaments.endDate,
  createdAt: tournaments.createdAt,
  updatedAt: tournaments.updatedAt,
} as const;

type SqlOrValue<T> = Exclude<T, null> | SQL;

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
export class TournamentRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  // CREATE
  // ============================================================
  async create(data: CreateTournamentData): Promise<Tournament> {
    const id = uuidv4();
    const now = new Date();

    const raw = {
      id,
      name: data.name,
      season: data.season,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: now,
      updatedAt: now,
    };

    const insertData = Object.fromEntries(
      Object.entries(raw).filter(
        ([, value]) => value !== undefined && value !== null,
      ),
    );

    try {
      const result = (await this.db
        .insert(tournaments)
        .values(insertData)
        .returning(tournamentReturning)) as Tournament[];

      const [record] = result;
      if (!record) throw new Error('Failed to create tournament');
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
  async findById(id: string): Promise<Tournament | null> {
    const result = (await this.db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, id))
      .limit(1)) as Tournament[];

    const [record] = result;
    return record || null;
  }

  // ============================================================
  // FIND ALL (фильтры + сортировка, без пагинации)
  // ============================================================
  async findAll(
    filter?: TournamentFilters,
    orderBy: 'name' | 'season' | 'createdAt' = 'season',
    orderDir: 'ASC' | 'DESC' = 'DESC',
  ): Promise<Tournament[]> {
    const orderFieldMap = {
      name: tournaments.name,
      season: tournaments.season,
      createdAt: tournaments.createdAt,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.name) {
      conditions.push(like(tournaments.name, `%${filter.name}%`));
    }
    if (filter?.season) {
      conditions.push(eq(tournaments.season, filter.season));
    }
    if (filter?.type) {
      conditions.push(eq(tournaments.type, filter.type));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    return (await this.db
      .select()
      .from(tournaments)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(tournaments.id) : desc(tournaments.id),
      )) as Tournament[];
  }

  // ============================================================
  // UPDATE PARTIAL
  // ============================================================
  async updatePartial(data: UpdateTournamentData): Promise<Tournament | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    const setData = nullsToSql({
      ...fields,
      updatedAt: new Date(),
    });

    try {
      const result = (await this.db
        .update(tournaments)
        .set(setData)
        .where(eq(tournaments.id, id))
        .returning(tournamentReturning)) as Tournament[];

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
  // DELETE
  // ============================================================
  async delete(id: string): Promise<Tournament | null> {
    return await this.db.transaction(
      async (tx) => {
        const existing = (await tx
          .select()
          .from(tournaments)
          .where(eq(tournaments.id, id))
          .limit(1)) as Tournament[];

        const record = existing[0];
        if (!record) return null;

        const existingRef = (await tx
          .select({ id: stages.id })
          .from(stages)
          .where(eq(stages.tournamentId, record.id))
          .limit(1)) as { id: string }[];

        if (existingRef.length > 0) {
          throw new DbForeignKeyViolationException(
            [{ dbField: 'tournament_id', value: record.id }],
            'fk_stages_tournament',
          );
        }

        const deleted = (await tx
          .delete(tournaments)
          .where(eq(tournaments.id, id))
          .returning(tournamentReturning)) as Tournament[];

        return deleted[0] || null;
      },
      { idempotent: true },
    );
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
