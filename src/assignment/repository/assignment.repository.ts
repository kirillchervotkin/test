// src/assignments/repository/assignment.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, gte, lte, lt, ne, asc, desc, inArray } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { assignments } from '../entities/assignment.schema.js';
import { matches } from '../../matches/entities/match.schema.js';
import { users } from '../../user/entities/user.schema.js';
import { fieldRoles } from '../../fieldRole/entities/field-role.schema.js';
import { cities } from '../../city/entities/city.schema.js';
import { stages } from '../../stages/entities/stage.schema.js';
import { teams } from '../../team/entities/team.schema.js';
import {
  Assignment,
  CreateAssignmentData,
  UpdateAssignmentData,
  AssignmentFilters,
  AssignmentWithDetails,
} from '../entities/types/assignment.types.js';
import type {
  Match,
  MatchWithDetails,
} from '../../matches/entities/types/match.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../../common/exceptions/db-foreign-key-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;
type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];
type DrizzleRunner = DrizzleDb | DrizzleTx;

const YDB_UNIQUE_VIOLATION_CODE = 400120;

@Injectable()
export class AssignmentRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  /**
   * Набор полей для `.returning(...)` — только колонки assignments.
   */
  private readonly selectShape = {
    id: assignments.id,
    matchId: assignments.matchId,
    userId: assignments.userId,
    fieldRoleId: assignments.fieldRoleId,
  } as const;

  // ============================================================
  // INTERNAL HELPERS
  //
  // Принимают runner (db или tx). Вызываются СТРОГО ВНУТРИ
  // транзакции, в одном снапшоте с записью — защита от race
  // condition через YDB SERIALIZABLE + idempotent: true.
  // ============================================================

  /**
   * Читает матч по id и возвращает его `matchDate`.
   * Один SELECT: проверяет существование матча и даёт дату
   * для проверки «два матча в день».
   */
  private async readMatchDate(
    matchId: string,
    runner: DrizzleRunner,
  ): Promise<Date> {
    const rows = (await runner
      .select({ matchDate: matches.matchDate })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1)) as { matchDate: Date }[];

    const row = rows[0];
    if (!row) {
      throw new DbForeignKeyViolationException([
        { dbField: 'match_id', value: matchId },
      ]);
    }
    return row.matchDate;
  }

  private async ensureUserExists(
    userId: string,
    runner: DrizzleRunner,
  ): Promise<void> {
    const rows = (await runner
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)) as { id: string }[];

    if (rows.length === 0) {
      throw new DbForeignKeyViolationException([
        { dbField: 'user_id', value: userId },
      ]);
    }
  }

  private async ensureFieldRoleExists(
    fieldRoleId: string,
    runner: DrizzleRunner,
  ): Promise<void> {
    const rows = (await runner
      .select({ id: fieldRoles.id })
      .from(fieldRoles)
      .where(eq(fieldRoles.id, fieldRoleId))
      .limit(1)) as { id: string }[];

    if (rows.length === 0) {
      throw new DbForeignKeyViolationException([
        { dbField: 'field_role_id', value: fieldRoleId },
      ]);
    }
  }

  /**
   * Проверяет, что судья не назначен на этот матч дважды.
   *
   * `excludeId` — id текущего назначения (для update, чтобы
   * не ловить «самосовпадение» при смене роли).
   */
  private async ensureNoDuplicateOnMatch(
    matchId: string,
    userId: string,
    runner: DrizzleRunner,
    excludeId?: string,
  ): Promise<void> {
    const conditions = [
      eq(assignments.matchId, matchId),
      eq(assignments.userId, userId),
    ];
    if (excludeId) {
      conditions.push(ne(assignments.id, excludeId));
    }

    const rows = (await runner
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(...conditions))
      .limit(1)) as { id: string }[];

    if (rows.length > 0) {
      throw new DbUniqueViolationException([
        { dbField: 'match_id', value: matchId },
        { dbField: 'user_id', value: userId },
      ]);
    }
  }

  /**
   * Проверяет, что судья не назначен на другой матч в тот же
   * календарный день.
   *
   * Логика: вычисляем границы дня в UTC, ищем любые назначения
   * этого судьи, у которых matchDate попадает в эти границы.
   * Текущий матч исключаем — иначе при update (смена роли)
   * поймаем сами себя.
   *
   * Требует JOIN с matches, потому что дата матча лежит там,
   * а не в assignments.
   */
  private async ensureNoSameDayConflict(
    userId: string,
    matchDate: Date,
    currentMatchId: string,
    runner: DrizzleRunner,
  ): Promise<void> {
    const dayStart = new Date(matchDate);
    dayStart.setUTCHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const rows = (await runner
      .select({ id: assignments.id })
      .from(assignments)
      .innerJoin(matches, eq(assignments.matchId, matches.id))
      .where(
        and(
          eq(assignments.userId, userId),
          gte(matches.matchDate, dayStart),
          lt(matches.matchDate, dayEnd),
          ne(matches.id, currentMatchId),
        ),
      )
      .limit(1)) as { id: string }[];

    if (rows.length > 0) {
      throw new DbUniqueViolationException([
        {
          dbField: 'user_id',
          value: `${userId} (already assigned to another match on ${dayStart.toISOString().slice(0, 10)})`,
        },
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
  // Всё в одной транзакции:
  //   1. Читаем match → получаем matchDate.
  //   2. Проверяем user.
  //   3. Проверяем fieldRole.
  //   4. Проверяем дубликат (тот же матч + тот же судья).
  //   5. Проверяем «два матча в день» (по дате матча).
  //   6. INSERT.
  //
  // Проверка 1 покрывает и существование матча, и даёт дату.
  // ============================================================
  async create(data: CreateAssignmentData): Promise<Assignment> {
    const id = uuidv4();

    const execute = async (runner: DrizzleRunner): Promise<Assignment> => {
      // 1. Матч существует + дата матча.
      const matchDate = await this.readMatchDate(data.matchId, runner);

      // 2. Судья существует.
      await this.ensureUserExists(data.userId, runner);

      // 3. Роль существует.
      await this.ensureFieldRoleExists(data.fieldRoleId, runner);

      // 4. Судья не назначен на этот матч дважды.
      await this.ensureNoDuplicateOnMatch(data.matchId, data.userId, runner);

      // 5. Судья не назначен на другой матч в тот же день.
      await this.ensureNoSameDayConflict(
        data.userId,
        matchDate,
        data.matchId,
        runner,
      );

      // 6. INSERT.
      try {
        const rows = (await runner
          .insert(assignments)
          .values({
            id,
            matchId: data.matchId,
            userId: data.userId,
            fieldRoleId: data.fieldRoleId,
          })
          .returning(this.selectShape)) as Assignment[];

        const [newRow] = rows;
        if (!newRow) throw new Error('Failed to create assignment');
        return newRow;
      } catch (err) {
        if (this.isDuplicateError(err)) {
          throw new DbUniqueViolationException([
            { dbField: 'match_id', value: data.matchId },
            { dbField: 'user_id', value: data.userId },
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
  async findById(id: string): Promise<Assignment | null> {
    const rows = (await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.id, id))
      .limit(1)) as Assignment[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND ALL BY MATCH
  // Все назначения матча (без деталей).
  // ============================================================
  async findAllByMatch(matchId: string): Promise<Assignment[]> {
    return (await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.matchId, matchId))) as Assignment[];
  }

  // ============================================================
  // FIND ALL BY MATCH WITH DETAILS
  //
  // Все назначения матча с ФИО судьи и данными роли.
  // Отсортированы по sortOrder роли — Главный судья первый.
  //
  // Используется в MatchCrewController: GET /matches/:id/crew.
  // ============================================================
  async findAllByMatchWithDetails(
    matchId: string,
  ): Promise<AssignmentWithDetails[]> {
    return (await this.db
      .select({
        id: assignments.id,
        matchId: assignments.matchId,
        userId: assignments.userId,
        fieldRoleId: assignments.fieldRoleId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        roleCode: fieldRoles.code,
        roleName: fieldRoles.name,
        roleSortOrder: fieldRoles.sortOrder,
      })
      .from(assignments)
      .innerJoin(users, eq(assignments.userId, users.id))
      .innerJoin(fieldRoles, eq(assignments.fieldRoleId, fieldRoles.id))
      .where(eq(assignments.matchId, matchId))
      .orderBy(
        asc(fieldRoles.sortOrder),
        asc(users.lastName),
      )) as AssignmentWithDetails[];
  }

  // ============================================================
  // FIND MATCH WITH DETAILS
  //
  // Читает матч с именами команд, города и этапа.
  // Используется в MatchCrewController для склейки «матч + бригада».
  //
  // Репозиторий назначений читает схему matches напрямую — так же,
  // как уже делает это для проверки «два матча в день». Это
  // осознанное решение: модуль assignments не зависит от
  // MatchModule, вся логика бригады (включая её контекст) —
  // в одном месте.
  //
  // Реализация: один SELECT с LEFT JOIN на cities и stages,
  // плюс отдельный SELECT на имена команд через inArray.
  //
  // Почему не два JOIN на teams (для home и away) в одном запросе:
  // нужен alias таблицы, а поддержка alias в YDB-адаптере
  // не гарантирована. Отдельный SELECT на команды — надёжнее
  // и не сильно медленнее (2 команды).
  // ============================================================
  async findMatchWithDetails(
    matchId: string,
  ): Promise<MatchWithDetails | null> {
    // 1. Матч + город + этап.
    const rows = (await this.db
      .select({
        id: matches.id,
        tournamentId: matches.tournamentId,
        stageId: matches.stageId,
        tourNumber: matches.tourNumber,
        matchDate: matches.matchDate,
        cityId: matches.cityId,
        homeTeamId: matches.homeTeamId,
        awayTeamId: matches.awayTeamId,
        homeScore: matches.homeScore,
        awayScore: matches.awayScore,
        cityName: cities.name,
        stageName: stages.name,
      })
      .from(matches)
      .leftJoin(cities, eq(matches.cityId, cities.id))
      .leftJoin(stages, eq(matches.stageId, stages.id))
      .where(eq(matches.id, matchId))
      .limit(1)) as Array<Match & { cityName: string; stageName: string }>;

    const row = rows[0];
    if (!row) return null;

    // 2. Имена команд — отдельный SELECT.
    const teamIds = [row.homeTeamId, row.awayTeamId].filter(
      (id): id is string => id !== null,
    );

    const teamMap = new Map<string, string>();
    if (teamIds.length > 0) {
      const teamRows = (await this.db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(inArray(teams.id, teamIds))) as {
        id: string;
        name: string;
      }[];
      for (const t of teamRows) {
        teamMap.set(t.id, t.name);
      }
    }

    // 3. Склейка.
    return {
      id: row.id,
      tournamentId: row.tournamentId,
      stageId: row.stageId,
      tourNumber: row.tourNumber,
      matchDate: row.matchDate,
      cityId: row.cityId,
      homeTeamId: row.homeTeamId,
      awayTeamId: row.awayTeamId,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
      cityName: row.cityName,
      stageName: row.stageName,
      homeTeamName: row.homeTeamId
        ? (teamMap.get(row.homeTeamId) ?? null)
        : null,
      awayTeamName: row.awayTeamId
        ? (teamMap.get(row.awayTeamId) ?? null)
        : null,
    };
  }

  // ============================================================
  // FIND ALL BY USER
  // Все назначения судьи (для отчётов «где судил Петров»).
  // ============================================================
  async findAllByUser(userId: string): Promise<Assignment[]> {
    return (await this.db
      .select()
      .from(assignments)
      .where(eq(assignments.userId, userId))) as Assignment[];
  }

  // ============================================================
  // FIND ALL (фильтры, сортировка, без пагинации)
  //
  // Назначения всегда смотрят с фильтром (по матчу, судье, роли
  // или дате). Без фильтра список бессмысленен — 2000 записей
  // за сезон никто не листает. Пагинация не нужна.
  //
  // Если заданы dateFrom / dateTo — JOIN с matches для фильтра
  // по дате матча. Иначе — простой SELECT без JOIN.
  //
  // Сортировка:
  //   - без dateFrom/dateTo — по id;
  //   - с ними — по matchDate.
  // ============================================================
  async findAll(
    filter?: AssignmentFilters,
    orderDir: 'ASC' | 'DESC' = 'ASC',
  ): Promise<Assignment[]> {
    const conditions = [];
    if (filter?.matchId) {
      conditions.push(eq(assignments.matchId, filter.matchId));
    }
    if (filter?.userId) {
      conditions.push(eq(assignments.userId, filter.userId));
    }
    if (filter?.fieldRoleId) {
      conditions.push(eq(assignments.fieldRoleId, filter.fieldRoleId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Простой случай — без фильтра по дате, без JOIN.
    if (!filter?.dateFrom && !filter?.dateTo) {
      return (await this.db
        .select()
        .from(assignments)
        .where(whereClause)
        .orderBy(
          orderDir === 'ASC' ? asc(assignments.id) : desc(assignments.id),
        )) as Assignment[];
    }

    // С фильтром по дате — JOIN с matches.
    const dateConditions = [...conditions];
    if (filter.dateFrom) {
      dateConditions.push(gte(matches.matchDate, filter.dateFrom));
    }
    if (filter.dateTo) {
      dateConditions.push(lte(matches.matchDate, filter.dateTo));
    }

    const dateWhere = dateConditions.length
      ? and(...dateConditions)
      : undefined;

    return (await this.db
      .select({
        id: assignments.id,
        matchId: assignments.matchId,
        userId: assignments.userId,
        fieldRoleId: assignments.fieldRoleId,
      })
      .from(assignments)
      .innerJoin(matches, eq(assignments.matchId, matches.id))
      .where(dateWhere)
      .orderBy(
        orderDir === 'ASC' ? asc(matches.matchDate) : desc(matches.matchDate),
      )) as Assignment[];
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // `matchId` НЕ меняется: перенос назначения на другой матч —
  // это delete + create.
  //
  // Логика:
  //   1. Читаем текущее назначение.
  //   2. Читаем матч (для matchDate — нужно для проверки
  //      «два матча в день»). Матч не меняется, но дата нужна.
  //   3. Если userId меняется — проверяем нового судью:
  //      существует, нет дубликата на матче (исключая текущее
  //      назначение), нет другого матча в тот же день (исключая
  //      текущий матч).
  //   4. Если fieldRoleId меняется — проверяем роль.
  //   5. UPDATE.
  //
  // Всё в одной транзакции.
  // ============================================================
  async updatePartial(data: UpdateAssignmentData): Promise<Assignment | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    const execute = async (
      runner: DrizzleRunner,
    ): Promise<Assignment | null> => {
      // 1. Текущее назначение.
      const currentRows = (await runner
        .select()
        .from(assignments)
        .where(eq(assignments.id, id))
        .limit(1)) as Assignment[];

      const current = currentRows[0];
      if (!current) return null;

      // 2. Дата матча (матч не меняется).
      const matchDate = await this.readMatchDate(current.matchId, runner);

      // 3. Если меняется судья — проверяем нового.
      if (fields.userId !== undefined && fields.userId !== current.userId) {
        await this.ensureUserExists(fields.userId, runner);
        await this.ensureNoDuplicateOnMatch(
          current.matchId,
          fields.userId,
          runner,
          id, // исключаем текущее назначение
        );
        await this.ensureNoSameDayConflict(
          fields.userId,
          matchDate,
          current.matchId, // исключаем текущий матч
          runner,
        );
      }

      // 4. Если меняется роль — проверяем.
      if (
        fields.fieldRoleId !== undefined &&
        fields.fieldRoleId !== current.fieldRoleId
      ) {
        await this.ensureFieldRoleExists(fields.fieldRoleId, runner);
      }

      // 5. UPDATE.
      try {
        const rows = (await runner
          .update(assignments)
          .set(fields)
          .where(eq(assignments.id, id))
          .returning(this.selectShape)) as Assignment[];
        return rows[0] ?? null;
      } catch (err) {
        if (this.isDuplicateError(err)) {
          throw new DbUniqueViolationException([
            { dbField: 'assignment', value: id },
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
  // Ссылок на назначение из других таблиц нет.
  // Простое удаление.
  // ============================================================
  async delete(id: string): Promise<Assignment | null> {
    const rows = (await this.db
      .delete(assignments)
      .where(eq(assignments.id, id))
      .returning(this.selectShape)) as Assignment[];
    return rows[0] ?? null;
  }

  // ============================================================
  // DELETE ALL BY MATCH
  // Каскад при удалении матча. Удаляет все назначения матча
  // одним запросом.
  // ============================================================
  async deleteAllByMatch(matchId: string): Promise<void> {
    await this.db.delete(assignments).where(eq(assignments.matchId, matchId));
  }
}
