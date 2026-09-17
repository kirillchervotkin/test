// src/report/report.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { eq, desc, and, inArray } from 'drizzle-orm';
import type { YdbDrizzleDatabase } from '@ydbjs/drizzle-adapter';
import { users } from '../user/entities/user.schema.js';
import { results } from '../result/entities/result.schema.js';
import { usersLists } from '../user-list/users-lists.schema.js';
import { trainingCamps } from '../training_camp/entities/training-camp.schema.js';
import { testTypes } from '../test-type/entities/test-type.schema.js';
import { testGrades } from '../test-grades/entities/test-grades.schema.js';
import { resultTestTypes } from '../result-test-types/entities/result-test-type.schema.js';
import { DRIZZLE } from '../common/ydb/ydb.constants.js';
import type { ResultStatus } from '../result/entities/types/result.types.js';
import { UserReportRow, AttemptReport, ReportStatus } from './report.types.js';

type DrizzleDb = YdbDrizzleDatabase;

interface GradeRow {
  grade: string;
  threshold: number;
  color: string;
}

interface TestTypeRow {
  id: string;
  parameter: string;
  failThresholdTime: number | null;
  attemptsCount: number | null;
}

interface UserRow {
  id: string;
  firstName: string;
  lastName: string;
}

interface ResultRow {
  userId: string;
  isTen: boolean;
  legNumber: number;
  status: ResultStatus;
  time: number | null;
  testDate: Date;
  trainingCampId: string;
  campStartDate: Date | null;
}

@Injectable()
export class ReportRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  async getUsersResultsByList(
    listId: string,
    testTypeId: string,
    campId?: string,
  ): Promise<UserReportRow[]> {
    // ----------------------------------------------------------
    // 1. Тип теста и его градации
    // ----------------------------------------------------------
    const testTypeRows = (await this.db
      .select({
        id: testTypes.id,
        parameter: testTypes.parameter,
        failThresholdTime: testTypes.failThresholdTime,
        attemptsCount: testTypes.attemptsCount,
      })
      .from(testTypes)
      .where(eq(testTypes.id, testTypeId))
      .limit(1)) as TestTypeRow[];

    const testType = testTypeRows[0];
    if (!testType) return [];

    const totalSlots = (testType.attemptsCount ?? 0) + 1; // N + слот пересдачи

    const grades = (await this.db
      .select({
        grade: testGrades.grade,
        threshold: testGrades.threshold,
        color: testGrades.color,
      })
      .from(testGrades)
      .where(eq(testGrades.testTypeId, testTypeId))) as GradeRow[];

    // Сортировка по возрастанию порога: лучшая градация — первая.
    grades.sort((a, b) => a.threshold - b.threshold);

    // ----------------------------------------------------------
    // 2. Целевые сборы
    // ----------------------------------------------------------
    let targetCampIds: string[];
    if (campId) {
      targetCampIds = [campId];
    } else {
      const activeCamps = (await this.db
        .select({ id: trainingCamps.id })
        .from(trainingCamps)
        .where(eq(trainingCamps.isActive, true))
        .orderBy(desc(trainingCamps.startDate))) as { id: string }[];

      if (activeCamps.length === 0) return [];
      targetCampIds = activeCamps.map((c) => c.id);
    }

    // ----------------------------------------------------------
    // 3. Пользователи списка
    // ----------------------------------------------------------
    const usersRows = (await this.db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .innerJoin(usersLists, eq(users.id, usersLists.userId))
      .where(eq(usersLists.listId, listId))) as UserRow[];

    if (usersRows.length === 0) return [];
    const userIds = usersRows.map((u) => u.id);

    // ----------------------------------------------------------
    // 4. Результаты по целевым сборам и типу теста.
    //    Связь с типом теста — через result_test_types (many-to-many).
    // ----------------------------------------------------------
    const resultsRows = (await this.db
      .select({
        userId: results.userId,
        isTen: results.isTen,
        legNumber: results.legNumber,
        status: results.status,
        time: results.time,
        testDate: results.testDate,
        trainingCampId: results.trainingCampId,
        campStartDate: trainingCamps.startDate,
      })
      .from(results)
      .innerJoin(trainingCamps, eq(results.trainingCampId, trainingCamps.id))
      .innerJoin(resultTestTypes, eq(results.id, resultTestTypes.resultId))
      .where(
        and(
          inArray(results.trainingCampId, targetCampIds),
          inArray(results.userId, userIds),
          eq(resultTestTypes.testTypeId, testTypeId),
        ),
      )) as ResultRow[];

    // ----------------------------------------------------------
    // 5. Для каждого пользователя — только самый свежий сбор,
    //    в котором у него есть записи по этому типу теста.
    // ----------------------------------------------------------
    const userMaxCampDate = new Map<string, Date>();
    for (const r of resultsRows) {
      if (!r.campStartDate) continue;
      const current = userMaxCampDate.get(r.userId);
      if (!current || r.campStartDate > current) {
        userMaxCampDate.set(r.userId, r.campStartDate);
      }
    }

    const filtered = resultsRows.filter((r) => {
      const maxDate = userMaxCampDate.get(r.userId);
      return (
        maxDate !== undefined &&
        r.campStartDate !== null &&
        r.campStartDate.getTime() === maxDate.getTime()
      );
    });

    // ----------------------------------------------------------
    // 6. Группировка по пользователю и isTen
    // ----------------------------------------------------------
    const byUser = new Map<string, { main: ResultRow[]; ten: ResultRow[] }>();
    for (const u of usersRows) {
      byUser.set(u.id, { main: [], ten: [] });
    }
    for (const r of filtered) {
      const bucket = byUser.get(r.userId);
      if (!bucket) continue;
      (r.isTen ? bucket.ten : bucket.main).push(r);
    }

    // ----------------------------------------------------------
    // 7. Формируем отчёт
    // ----------------------------------------------------------
    const report: UserReportRow[] = [];

    for (const u of usersRows) {
      const bucket = byUser.get(u.id)!;

      const attempts = this.buildAttempts(
        bucket.main,
        totalSlots,
        testType,
        grades,
      );
      const attempts10m = this.buildAttempts(
        bucket.ten,
        totalSlots,
        testType,
        grades,
      );

      // Среднее — только по зачётным основным попыткам.
      const creditedTimes = bucket.main
        .filter(
          (r) =>
            r.status === 'completed' &&
            r.time != null &&
            this.isPassed(r.time, testType.failThresholdTime),
        )
        .map((r) => r.time!);

      const averageTime =
        creditedTimes.length > 0
          ? creditedTimes.reduce((a, b) => a + b, 0) / creditedTimes.length
          : null;

      const overallGrade =
        averageTime != null ? this.computeGrade(averageTime, grades) : null;

      const status = this.computeStatus(bucket.main, testType);

      report.push({
        lastName: u.lastName,
        firstName: u.firstName,
        attempts,
        attempts10m,
        averageTime,
        grade: overallGrade?.grade ?? null,
        gradeColor: overallGrade?.color ?? null,
        status,
      });
    }

    report.sort((a, b) => a.lastName.localeCompare(b.lastName));
    return report;
  }

  // ============================================================
  // ХЕЛПЕРЫ
  // ============================================================

  /**
   * Строит массив слотов длины totalSlots (N+1).
   * Каждый элемент — AttemptReport или null (слот не заполнен).
   * Слоты индексируются по leg_number (1..N+1).
   */
  private buildAttempts(
    records: ResultRow[],
    totalSlots: number,
    testType: TestTypeRow,
    grades: GradeRow[],
  ): (AttemptReport | null)[] {
    const byLeg = new Map<number, ResultRow>();
    for (const r of records) {
      // На случай, если по одному leg_number окажется больше одной записи
      // — берём самую свежую по testDate.
      const existing = byLeg.get(r.legNumber);
      if (!existing || r.testDate > existing.testDate) {
        byLeg.set(r.legNumber, r);
      }
    }

    const slots: (AttemptReport | null)[] = [];
    for (let leg = 1; leg <= totalSlots; leg++) {
      const r = byLeg.get(leg);
      if (!r) {
        slots.push(null);
        continue;
      }

      const isCompleted = r.status === 'completed' && r.time != null;
      const passed = isCompleted
        ? this.isPassed(r.time!, testType.failThresholdTime)
        : null;
      const gradeInfo =
        isCompleted && passed ? this.computeGrade(r.time!, grades) : null;

      slots.push({
        legNumber: r.legNumber,
        status: r.status,
        time: r.time,
        passed,
        grade: gradeInfo?.grade ?? null,
        gradeColor: gradeInfo?.color ?? null,
      });
    }
    return slots;
  }

  /**
   * Уложилась ли попытка в порог сдачи.
   * Если порог не задан — считаем, что уложилась
   * (для time-теста порог по бизнес-логике должен быть заполнен).
   */
  private isPassed(time: number, failThresholdTime: number | null): boolean {
    if (failThresholdTime == null) return true;
    return time <= failThresholdTime;
  }

  /**
   * Градация для конкретного времени.
   * `grades` отсортирован по возрастанию порога: первая градация,
   * чей порог >= time, — то, что нужно.
   */
  private computeGrade(
    time: number,
    grades: GradeRow[],
  ): { grade: string; color: string } | null {
    for (const g of grades) {
      if (time <= g.threshold) return { grade: g.grade, color: g.color };
    }
    return null;
  }

  /**
   * Итоговый статус по основным попыткам (isTen = false).
   *
   *   1. Нет ни одной записи                       → 'not_attempted'
   *   2. Все записи имеют статус not_admitted      → 'not_admitted'
   *   3. Записей меньше, чем N (attemptsCount)     → 'technical_error'
   *   4. Зачётов (time <= порога) >= N             → 'passed'
   *   5. Иначе (попытки были, зачётов мало,
   *      not_credited входит в число незачётных)   → 'failed'
   */
  private computeStatus(
    records: ResultRow[],
    testType: TestTypeRow,
  ): ReportStatus {
    if (records.length === 0) return 'not_attempted';

    const allNotAdmitted = records.every((r) => r.status === 'not_admitted');
    if (allNotAdmitted) return 'not_admitted';

    const requiredCount = testType.attemptsCount ?? 0;
    if (records.length < requiredCount) return 'technical_error';

    const credited = records.filter(
      (r) =>
        r.status === 'completed' &&
        r.time != null &&
        this.isPassed(r.time, testType.failThresholdTime),
    ).length;

    if (credited >= requiredCount) return 'passed';

    return 'failed';
  }
}
