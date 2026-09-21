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
export class StageRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  /**
   * Набор полей для `.returning(...)`, чтобы не дублировать его
   * в create / update / delete.
   */
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

  // ============================================================
  // INTERNAL HELPERS
  //
  // Принимают runner (db или tx) — это часть внутренней
  // транзакционной логики. В публичный API не выходят.
  // ============================================================

  /**
   * Проверяет существование родительского турнира.
   *
   * YDB не enforced FK, поэтому единственный способ поймать
   * нарушение — самим убедиться, что родитель есть.
   * Вызывается строго внутри транзакции, в одном снапшоте с записью.
   */
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

  /**
   * Проверяет существование родительского этапа (если задан).
   * Вызывается строго внутри транзакции.
   */
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
  // Всегда в транзакции: ensureTournamentExists +
  // ensureParentStageExists + insert должны быть в одном снапшоте.
  // ============================================================
  async create(data: CreateStageData): Promise<Stage> {
    const id = uuidv4();
    const now = new Date();

    const execute = async (runner: DrizzleRunner): Promise<Stage> => {
      // 1. Проверка FK — ВНУТРИ транзакции.
      await this.ensureTournamentExists(data.tournamentId, runner);
      if (data.parentStageId) {
        await this.ensureParentStageExists(data.parentStageId, runner);
      }

      // 2. INSERT
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

      // Отсеиваем null/undefined — YDB заполнит отсутствующие
      // колонки NULL без явного null-параметра.
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

  // ============================================================
  // FIND BY ID
  // ============================================================
  async findById(id: string): Promise<Stage | null> {
    const rows = (await this.db
      .select()
      .from(stages)
      .where(eq(stages.id, id))
      .limit(1)) as Stage[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND BY ID AND TOURNAMENT
  //
  // Compound-версия findById: tournament_id входит в WHERE.
  // Один запрос вместо «найти по id → сверить поле». Гарантирует,
  // что результат и URL согласованы: если этап принадлежит
  // другому турниру — вернётся null.
  // ============================================================
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

  // ============================================================
  // FIND ALL BY TOURNAMENT
  // Все этапы турнира, включая контейнеры и дочерние.
  // ============================================================
  async findAllByTournament(tournamentId: string): Promise<Stage[]> {
    return (await this.db
      .select()
      .from(stages)
      .where(eq(stages.tournamentId, tournamentId))
      .orderBy(asc(stages.sortOrder), asc(stages.id))) as Stage[];
  }

  // ============================================================
  // FIND ROOT STAGES BY TOURNAMENT
  // Корневые этапы (parentStageId IS NULL).
  // ============================================================
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

  // ============================================================
  // FIND CHILDREN
  // Дочерние этапы относительно указанного родителя.
  // ============================================================
  async findChildren(parentStageId: string): Promise<Stage[]> {
    return (await this.db
      .select()
      .from(stages)
      .where(eq(stages.parentStageId, parentStageId))
      .orderBy(asc(stages.sortOrder), asc(stages.id))) as Stage[];
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Разрешено менять name, type, format, sortOrder, settings,
  // parentStageId. tournamentId — нельзя.
  //
  // nullsToSql превращает явные null в SQL-литералы NULL.
  // ============================================================
  async updatePartial(data: UpdateStageData): Promise<Stage | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    const execute = async (runner: DrizzleRunner): Promise<Stage | null> => {
      if (fields.parentStageId !== undefined && fields.parentStageId !== null) {
        await this.ensureParentStageExists(fields.parentStageId, runner);
      }

      const setData = nullsToSql({
        ...fields,
        updatedAt: new Date(),
      });

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

  // ============================================================
  // UPDATE BY ID AND TOURNAMENT
  //
  // Compound-версия updatePartial: tournament_id входит в WHERE.
  // id берётся из ПЕРВОГО аргумента (path-параметр), а не из
  // data.id — это гарантирует, что клиент не подменит id телом
  // запроса.
  //
  // Поля внутри data: если data содержит id, он игнорируется
  // (деструктуризация с префиксом `_`).
  // ============================================================
  async updateByIdAndTournament(
    id: string,
    tournamentId: string,
    data: UpdateStageData,
  ): Promise<Stage | null> {
    // data.id не используем — id уже есть в первом аргументе.
    const { id: _ignoredId, ...fields } = data;
    void _ignoredId;

    if (Object.keys(fields).length === 0) {
      return this.findByIdAndTournament(id, tournamentId);
    }

    const execute = async (runner: DrizzleRunner): Promise<Stage | null> => {
      if (fields.parentStageId !== undefined && fields.parentStageId !== null) {
        await this.ensureParentStageExists(fields.parentStageId, runner);
      }

      const setData = nullsToSql({
        ...fields,
        updatedAt: new Date(),
      });

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

  // ============================================================
  // DELETE
  //
  // Проверяем, что у этапа нет дочерних этапов. Если есть —
  // удаление запрещаем (каскад должен быть явным решением
  // сервисного слоя, а не автоматикой БД).
  // ============================================================
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

  // ============================================================
  // DELETE BY ID AND TOURNAMENT
  //
  // Compound-версия delete: tournament_id входит в WHERE.
  // Если этап не принадлежит указанному турниру — вернёт null
  // (ничего не удалено).
  // ============================================================
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

  // ============================================================
  // DELETE ALL BY TOURNAMENT
  // Каскад при удалении турнира. Удаляет все этапы турнира
  // одним запросом.
  // ============================================================
  async deleteAllByTournament(tournamentId: string): Promise<void> {
    await this.db.delete(stages).where(eq(stages.tournamentId, tournamentId));
  }
}
