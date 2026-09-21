// src/stages/repository/stage.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, asc, sql, SQL, isNull } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { stages } from '../entities/stage.schema.js';
import { tournaments } from '../../tournaments/entities/tournament.schema.js';
import {
  Stage,
  CreateStageData,
  UpdateStageData,
} from '../entities/types/stage.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../../common/exceptions/db-foreign-key-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;
type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];
type DrizzleRunner = DrizzleDb | DrizzleTx;

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

const YDB_UNIQUE_VIOLATION_CODE = 400120;

@Injectable()
export class StageRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  private readonly selectShape = {
    id: stages.id,
    tournamentId: stages.tournamentId,
    parentStageId: stages.parentStageId,
    name: stages.name,
    type: stages.type,
    format: stages.format,
    sortOrder: stages.sortOrder,
    settings: stages.settings,
    createdAt: stages.createdAt,
    updatedAt: stages.updatedAt,
  } as const;

  private async ensureTournamentExists(
    tournamentId: string,
    runner: DrizzleRunner,
  ): Promise<void> {
    const rows = (await runner
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1)) as { id: string }[];

    if (rows.length === 0) {
      throw new DbForeignKeyViolationException([
        { dbField: 'tournament_id', value: tournamentId },
      ]);
    }
  }

  private async ensureParentStageExists(
    parentStageId: string,
    runner: DrizzleRunner,
  ): Promise<void> {
    const rows = (await runner
      .select({ id: stages.id })
      .from(stages)
      .where(eq(stages.id, parentStageId))
      .limit(1)) as { id: string }[];

    if (rows.length === 0) {
      throw new DbForeignKeyViolationException([
        { dbField: 'parent_stage_id', value: parentStageId },
      ]);
    }
  }

  private isDuplicateError(error: unknown): boolean {
    if (error instanceof YdbUniqueConstraintViolationError) return true;
    if (
      error instanceof YDBError &&
      (error.code as number) === YDB_UNIQUE_VIOLATION_CODE
    )
      return true;
    if (
      error instanceof Error &&
      'cause' in error &&
      error.cause instanceof YDBError &&
      (error.cause.code as number) === YDB_UNIQUE_VIOLATION_CODE
    )
      return true;
    return false;
  }

  async create(data: CreateStageData): Promise<Stage> {
    const id = uuidv4();
    const now = new Date();

    const execute = async (runner: DrizzleRunner): Promise<Stage> => {
      await this.ensureTournamentExists(data.tournamentId, runner);
      if (data.parentStageId) {
        await this.ensureParentStageExists(data.parentStageId, runner);
      }

      const raw = {
        id,
        tournamentId: data.tournamentId,
        parentStageId: data.parentStageId,
        name: data.name,
        type: data.type,
        format: data.format,
        sortOrder: data.sortOrder ?? 0,
        settings: data.settings,
        createdAt: now,
        updatedAt: now,
      };

      const insertData = Object.fromEntries(
        Object.entries(raw).filter(
          ([, value]) => value !== undefined && value !== null,
        ),
      );

      try {
        const rows = (await runner
          .insert(stages)
          .values(insertData)
          .returning(this.selectShape)) as Stage[];
        const [newRow] = rows;
        if (!newRow) throw new Error('Failed to create stage');
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

  async findById(id: string): Promise<Stage | null> {
    const rows = (await this.db
      .select()
      .from(stages)
      .where(eq(stages.id, id))
      .limit(1)) as Stage[];
    return rows[0] ?? null;
  }

  async findByIdAndTournament(
    id: string,
    tournamentId: string,
  ): Promise<Stage | null> {
    const rows = (await this.db
      .select()
      .from(stages)
      .where(and(eq(stages.id, id), eq(stages.tournamentId, tournamentId)))
      .limit(1)) as Stage[];
    return rows[0] ?? null;
  }

  async findAllByTournament(tournamentId: string): Promise<Stage[]> {
    return (await this.db
      .select()
      .from(stages)
      .where(eq(stages.tournamentId, tournamentId))
      .orderBy(asc(stages.sortOrder), asc(stages.id))) as Stage[];
  }

  async findRootByTournament(tournamentId: string): Promise<Stage[]> {
    return (await this.db
      .select()
      .from(stages)
      .where(
        and(
          eq(stages.tournamentId, tournamentId),
          isNull(stages.parentStageId),
        ),
      )
      .orderBy(asc(stages.sortOrder), asc(stages.id))) as Stage[];
  }

  async findChildren(parentStageId: string): Promise<Stage[]> {
    return (await this.db
      .select()
      .from(stages)
      .where(eq(stages.parentStageId, parentStageId))
      .orderBy(asc(stages.sortOrder), asc(stages.id))) as Stage[];
  }

  async updatePartial(data: UpdateStageData): Promise<Stage | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    const execute = async (runner: DrizzleRunner): Promise<Stage | null> => {
      if (fields.parentStageId !== undefined && fields.parentStageId !== null) {
        await this.ensureParentStageExists(fields.parentStageId, runner);
      }

      const setData = nullsToSql({ ...fields, updatedAt: new Date() });

      try {
        const rows = (await runner
          .update(stages)
          .set(setData)
          .where(eq(stages.id, id))
          .returning(this.selectShape)) as Stage[];
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

  async updateByIdAndTournament(
    id: string,
    tournamentId: string,
    data: UpdateStageData,
  ): Promise<Stage | null> {
    const { id: _ignoredId, ...fields } = data;
    void _ignoredId;

    if (Object.keys(fields).length === 0) {
      return this.findByIdAndTournament(id, tournamentId);
    }

    const execute = async (runner: DrizzleRunner): Promise<Stage | null> => {
      if (fields.parentStageId !== undefined && fields.parentStageId !== null) {
        await this.ensureParentStageExists(fields.parentStageId, runner);
      }

      const setData = nullsToSql({ ...fields, updatedAt: new Date() });

      try {
        const rows = (await runner
          .update(stages)
          .set(setData)
          .where(and(eq(stages.id, id), eq(stages.tournamentId, tournamentId)))
          .returning(this.selectShape)) as Stage[];
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

  async delete(id: string): Promise<Stage | null> {
    const execute = async (runner: DrizzleRunner): Promise<Stage | null> => {
      const existing = (await runner
        .select()
        .from(stages)
        .where(eq(stages.id, id))
        .limit(1)) as Stage[];
      if (!existing[0]) return null;

      const children = (await runner
        .select({ id: stages.id })
        .from(stages)
        .where(eq(stages.parentStageId, id))
        .limit(1)) as { id: string }[];

      if (children.length > 0) {
        throw new DbForeignKeyViolationException(
          [{ dbField: 'parent_stage_id', value: id }],
          'fk_stages_parent',
        );
      }

      const rows = (await runner
        .delete(stages)
        .where(eq(stages.id, id))
        .returning(this.selectShape)) as Stage[];
      return rows[0] ?? null;
    };

    return this.db.transaction(execute, { idempotent: true });
  }

  async deleteByIdAndTournament(
    id: string,
    tournamentId: string,
  ): Promise<Stage | null> {
    const execute = async (runner: DrizzleRunner): Promise<Stage | null> => {
      const existing = (await runner
        .select()
        .from(stages)
        .where(and(eq(stages.id, id), eq(stages.tournamentId, tournamentId)))
        .limit(1)) as Stage[];
      if (!existing[0]) return null;

      const children = (await runner
        .select({ id: stages.id })
        .from(stages)
        .where(eq(stages.parentStageId, id))
        .limit(1)) as { id: string }[];

      if (children.length > 0) {
        throw new DbForeignKeyViolationException(
          [{ dbField: 'parent_stage_id', value: id }],
          'fk_stages_parent',
        );
      }

      const rows = (await runner
        .delete(stages)
        .where(and(eq(stages.id, id), eq(stages.tournamentId, tournamentId)))
        .returning(this.selectShape)) as Stage[];
      return rows[0] ?? null;
    };

    return this.db.transaction(execute, { idempotent: true });
  }

  async deleteAllByTournament(tournamentId: string): Promise<void> {
    await this.db.delete(stages).where(eq(stages.tournamentId, tournamentId));
  }
}
