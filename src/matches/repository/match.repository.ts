// src/matches/repository/match.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, or, gte, lte, asc, desc, sql, SQL } from 'drizzle-orm';
import { YDBError } from '@ydbjs/error';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { matches } from '../entities/match.schema.js';
import { tournaments } from '../../tournaments/entities/tournament.schema.js';
import { stages } from '../../stages/entities/stage.schema.js';
import { cities } from '../../city/entities/city.schema.js';
import { teams } from '../../team/entities/team.schema.js';
import {
  Match,
  CreateMatchData,
  CreateMatchInput,
  UpdateMatchData,
  MatchFilters,
} from '../entities/types/match.types.js';
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
export class MatchRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  /**
   * Набор полей для `.returning(...)`, чтобы не дублировать его
   * в create / update / delete.
   */
  private readonly selectShape = {
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
  } as const;

  // ============================================================
  // INTERNAL HELPERS
  //
  // Принимают runner (db или tx) — часть внутренней транзакционной
  // логики. В публичный API не выходят.
  //
  // Все проверки вызываются СТРОГО ВНУТРИ транзакции, в одном
  // снапшоте с записью. Это защищает от race condition: если
  // параллельная транзакция удалит сущность между проверкой
  // и вставкой, YDB обнаружит конфликт блокировок на коммите
  // (SERIALIZABLE-изоляция + оптимистичные блокировки). При
  // `idempotent: true` адаптер автоматически перезапустит
  // транзакцию, и повторная проверка уже не найдёт удалённую
  // сущность → DbForeignKeyViolationException.
  // ============================================================

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

  private async ensureTeamExists(
    teamId: string,
    runner: DrizzleRunner,
  ): Promise<void> {
    const rows = (await runner
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1)) as { id: string }[];

    if (rows.length === 0) {
      throw new DbForeignKeyViolationException([
        { dbField: 'team_id', value: teamId },
      ]);
    }
  }

  /**
   * Читает этап по id и возвращает его `tournamentId` и `format`.
   *
   * Один SELECT, который одновременно:
   *   - проверяет существование этапа;
   *   - даёт `tournamentId` для INSERT. Согласованность
   *     `stage ↔ tournament` гарантируется тем, что оба значения
   *     берутся из одной строки `stages` — нечего проверять;
   *   - даёт `format` для проверки `tourNumber ↔ format`.
   *
   * Вызывается СТРОГО ВНУТРИ транзакции, в одном снапшоте с
   * последующим INSERT. Это исключает гонку: если параллельная
   * транзакция удалит этап между чтением и вставкой, YDB
   * обнаружит конфликт блокировок на коммите. При `idempotent: true`
   * адаптер перезапустит транзакцию, и повторное чтение уже не
   * найдёт этап → DbForeignKeyViolationException.
   */
  private async readStageContext(
    stageId: string,
    runner: DrizzleRunner,
  ): Promise<{
    tournamentId: string;
    format: 'ROUND_ROBIN' | 'ELIMINATION' | null;
  }> {
    const rows = (await runner
      .select({
        tournamentId: stages.tournamentId,
        format: stages.format,
      })
      .from(stages)
      .where(eq(stages.id, stageId))
      .limit(1)) as {
      tournamentId: string;
      format: 'ROUND_ROBIN' | 'ELIMINATION' | null;
    }[];

    const row = rows[0];
    if (!row) {
      throw new DbForeignKeyViolationException([
        { dbField: 'stage_id', value: stageId },
      ]);
    }
    return row;
  }

  /**
   * Проверяет согласованность `tourNumber` ↔ `stage.format`.
   *
   * Инварианты:
   *   - ROUND_ROBIN → tourNumber обязателен (number);
   *   - ELIMINATION / null (контейнер) → tourNumber должен быть
   *     null/undefined.
   *
   * Доменное правило, проверяемое в репозитории, потому что
   * требует `stage.format` — а его мы читаем в той же транзакции,
   * что и INSERT. Дублировать чтение в сервисе не нужно.
   *
   * Бросает DbForeignKeyViolationException — ближайшее семантически
   * подходящее исключение из доступных; клиент получит 409
   * с описанием проблемы. Если понадобится 400 (BadRequest) —
   * заменить на BadRequestException или создать отдельное
   * доменное исключение и замапить в глобальном фильтре.
   */
  private assertTourNumberConsistency(
    tourNumber: number | undefined | null,
    format: 'ROUND_ROBIN' | 'ELIMINATION' | null,
  ): void {
    const hasTourNumber = tourNumber !== null && tourNumber !== undefined;

    if (format === 'ROUND_ROBIN') {
      if (!hasTourNumber) {
        throw new DbForeignKeyViolationException([
          {
            dbField: 'tour_number',
            value: 'required for ROUND_ROBIN stages',
          },
        ]);
      }
      return;
    }

    // ELIMINATION или контейнер (null) — тур не должен быть задан.
    if (hasTourNumber) {
      throw new DbForeignKeyViolationException([
        {
          dbField: 'tour_number',
          value: 'only applicable to ROUND_ROBIN stages',
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
  //   1. Читаем stage → получаем tournamentId и format.
  //   2. Проверяем, что турнир существует (защита от висячего stage).
  //   3. Проверяем tourNumber ↔ format.
  //   4. Проверяем город.
  //   5. Проверяем команды (если заданы).
  //   6. INSERT с выведенным tournamentId.
  //
  // `tournamentId` НЕ приходит от клиента — берётся из stage.
  // Несогласованность `tournamentId ↔ stageId` невозможна
  // by design: оба значения из одной строки stages.
  // ============================================================
  async create(input: CreateMatchInput): Promise<Match> {
    const id = uuidv4();

    const execute = async (runner: DrizzleRunner): Promise<Match> => {
      // 1. Читаем stage: tournamentId + format.
      const stageCtx = await this.readStageContext(input.stageId, runner);

      // 2. Турнир существует (защита от висячего stage).
      await this.ensureTournamentExists(stageCtx.tournamentId, runner);

      // 3. Проверяем tourNumber ↔ format.
      this.assertTourNumberConsistency(input.tourNumber, stageCtx.format);

      // 4. Город существует.
      await this.ensureCityExists(input.cityId, runner);

      // 5. Команды существуют (если заданы).
      if (input.homeTeamId) {
        await this.ensureTeamExists(input.homeTeamId, runner);
      }
      if (input.awayTeamId) {
        await this.ensureTeamExists(input.awayTeamId, runner);
      }

      // 6. INSERT с выведенным tournamentId.
      const data: CreateMatchData = {
        ...input,
        tournamentId: stageCtx.tournamentId,
      };

      const raw = {
        id,
        tournamentId: data.tournamentId,
        stageId: data.stageId,
        tourNumber: data.tourNumber,
        matchDate: data.matchDate,
        cityId: data.cityId,
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
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
          .insert(matches)
          .values(insertData)
          .returning(this.selectShape)) as Match[];

        const [newRow] = rows;
        if (!newRow) throw new Error('Failed to create match');
        return newRow;
      } catch (err) {
        if (this.isDuplicateError(err)) {
          throw new DbUniqueViolationException([
            {
              dbField: 'match',
              value: `${data.stageId}:${data.matchDate.toISOString()}`,
            },
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
  async findById(id: string): Promise<Match | null> {
    const rows = (await this.db
      .select()
      .from(matches)
      .where(eq(matches.id, id))
      .limit(1)) as Match[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND ALL BY STAGE
  // Все матчи этапа, отсортированы по дате.
  // ============================================================
  async findAllByStage(stageId: string): Promise<Match[]> {
    return (await this.db
      .select()
      .from(matches)
      .where(eq(matches.stageId, stageId))
      .orderBy(asc(matches.matchDate), asc(matches.id))) as Match[];
  }

  // ============================================================
  // FIND ALL BY TOURNAMENT
  // Все матчи турнира, отсортированы по дате.
  // ============================================================
  async findAllByTournament(tournamentId: string): Promise<Match[]> {
    return (await this.db
      .select()
      .from(matches)
      .where(eq(matches.tournamentId, tournamentId))
      .orderBy(asc(matches.matchDate), asc(matches.id))) as Match[];
  }

  // ============================================================
  // FIND ALL BY TEAM
  // Все матчи команды (home OR away).
  //
  // YDB обычно использует только один индекс в OR-запросе, поэтому
  // это будет full-scan по одному из индексов. Для масштаба
  // «тысячи матчей» — приемлемо.
  // ============================================================
  async findAllByTeam(teamId: string): Promise<Match[]> {
    return (await this.db
      .select()
      .from(matches)
      .where(or(eq(matches.homeTeamId, teamId), eq(matches.awayTeamId, teamId)))
      .orderBy(asc(matches.matchDate), asc(matches.id))) as Match[];
  }

  // ============================================================
  // FIND ALL (фильтры, пагинация, сортировка)
  //
  // Пагинация нужна: матчей сотни и тысячи.
  //
  // Возвращает { rows, total } — total считается отдельным
  // запросом с теми же фильтрами, но без limit/offset.
  // ============================================================
  async findAll(
    filter?: MatchFilters,
    limit = 100,
    offset = 0,
    orderBy: 'matchDate' | 'tourNumber' = 'matchDate',
    orderDir: 'ASC' | 'DESC' = 'ASC',
  ): Promise<{ rows: Match[]; total: number }> {
    const orderFieldMap = {
      matchDate: matches.matchDate,
      tourNumber: matches.tourNumber,
    };
    const orderField = orderFieldMap[orderBy];
    if (!orderField) throw new Error(`Invalid orderBy field: ${orderBy}`);

    const conditions = [];
    if (filter?.tournamentId) {
      conditions.push(eq(matches.tournamentId, filter.tournamentId));
    }
    if (filter?.stageId) {
      conditions.push(eq(matches.stageId, filter.stageId));
    }
    if (filter?.cityId) {
      conditions.push(eq(matches.cityId, filter.cityId));
    }
    if (filter?.teamId) {
      conditions.push(
        or(
          eq(matches.homeTeamId, filter.teamId),
          eq(matches.awayTeamId, filter.teamId),
        ),
      );
    }
    if (filter?.tourNumber !== undefined) {
      conditions.push(eq(matches.tourNumber, filter.tourNumber));
    }
    if (filter?.dateFrom) {
      conditions.push(gte(matches.matchDate, filter.dateFrom));
    }
    if (filter?.dateTo) {
      conditions.push(lte(matches.matchDate, filter.dateTo));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const rows = (await this.db
      .select()
      .from(matches)
      .where(whereClause)
      .orderBy(
        orderDir === 'ASC' ? asc(orderField) : desc(orderField),
        orderDir === 'ASC' ? asc(matches.id) : desc(matches.id),
      )
      .limit(limit)
      .offset(offset)) as Match[];

    const countResult = (await this.db
      .select({ count: sql<number>`count(*)` })
      .from(matches)
      .where(whereClause)) as { count: number }[];

    const [{ count }] = countResult;
    return { rows, total: Number(count ?? 0) };
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Всё в транзакции:
  //   1. Если cityId меняется — проверяем город.
  //   2. Если homeTeamId / awayTeamId меняется — проверяем команды.
  //   3. UPDATE с nullsToSql.
  //
  // `tournamentId` и `stageId` не меняются — перенос между
  // турнирами/этапами это delete + create. Поэтому проверка
  // `tourNumber ↔ format` при update не нужна: stageId тот же,
  // format тот же, что при create.
  //
  // nullsToSql превращает явные null в SQL-литералы NULL:
  //   PATCH { homeTeamId: null }  → «убрать хозяев»
  //   PATCH { homeScore: null }   → «сбросить счёт»
  // ============================================================
  async updatePartial(data: UpdateMatchData): Promise<Match | null> {
    const { id, ...fields } = data;
    if (Object.keys(fields).length === 0) return this.findById(id);

    const execute = async (runner: DrizzleRunner): Promise<Match | null> => {
      // Проверка cityId (если меняется на не-null значение).
      if (fields.cityId !== undefined && fields.cityId !== null) {
        await this.ensureCityExists(fields.cityId, runner);
      }

      // Проверка homeTeamId (если меняется на не-null значение).
      if (fields.homeTeamId !== undefined && fields.homeTeamId !== null) {
        await this.ensureTeamExists(fields.homeTeamId, runner);
      }

      // Проверка awayTeamId (если меняется на не-null значение).
      if (fields.awayTeamId !== undefined && fields.awayTeamId !== null) {
        await this.ensureTeamExists(fields.awayTeamId, runner);
      }

      const setData = nullsToSql(fields);

      try {
        const rows = (await runner
          .update(matches)
          .set(setData)
          .where(eq(matches.id, id))
          .returning(this.selectShape)) as Match[];
        return rows[0] ?? null;
      } catch (err) {
        if (this.isDuplicateError(err)) {
          throw new DbUniqueViolationException([
            { dbField: 'match', value: id },
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
  // Ссылок на матч пока нет (назначения появятся позже).
  // Когда появится AssignmentRepository — delete станет
  // транзакционным с проверкой ссылок.
  // ============================================================
  async delete(id: string): Promise<Match | null> {
    const rows = (await this.db
      .delete(matches)
      .where(eq(matches.id, id))
      .returning(this.selectShape)) as Match[];
    return rows[0] ?? null;
  }

  // ============================================================
  // DELETE ALL BY STAGE
  // Каскад при удалении этапа. Удаляет все матчи этапа одним
  // запросом.
  // ============================================================
  async deleteAllByStage(stageId: string): Promise<void> {
    await this.db.delete(matches).where(eq(matches.stageId, stageId));
  }

  // ============================================================
  // DELETE ALL BY TOURNAMENT
  // Каскад при удалении турнира. Удаляет все матчи турнира
  // одним запросом.
  // ============================================================
  async deleteAllByTournament(tournamentId: string): Promise<void> {
    await this.db.delete(matches).where(eq(matches.tournamentId, tournamentId));
  }
}
