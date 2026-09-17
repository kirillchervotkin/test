// src/report/report.types.ts

import type { ResultStatus } from '../result/entities/types/result.types.js';

/**
 * Итоговый статус пользователя в отчёте по конкретному типу теста.
 *
 *   - 'passed'          — набрано не меньше N зачётных попыток
 *                         (N = attemptsCount типа теста);
 *   - 'failed'          — попытки были, но зачётов меньше N;
 *   - 'technical_error' — записей меньше N, но больше нуля
 *                         (админ забыл внести результат);
 *   - 'not_admitted'    — все существующие попытки со статусом not_admitted;
 *   - 'not_attempted'   — в активных сборах по этому типу теста нет
 *                         ни одной записи. Спортсмен ещё не пробовал.
 */
export type ReportStatus =
  | 'passed'
  | 'failed'
  | 'technical_error'
  | 'not_admitted'
  | 'not_attempted';

/**
 * Единственный источник правды по списку статусов.
 * Используется в DTO для @IsIn / enum в Swagger.
 */
export const REPORT_STATUSES: readonly ReportStatus[] = [
  'passed',
  'failed',
  'technical_error',
  'not_admitted',
  'not_attempted',
] as const;

/**
 * Одна попытка в отчёте.
 * В массиве слотов элемент может быть null — слот не заполнен
 * (например, спортсмен не использовал пересдачу).
 */
export interface AttemptReport {
  /** Номер слота: 1..N+1. */
  legNumber: number;
  /** Статус попытки (completed / not_credited / not_admitted). */
  status: ResultStatus;
  /** Время в секундах (null для not_admitted и для слотов без метрики). */
  time: number | null;
  /**
   * Уложилась ли попытка в failThresholdTime.
   * null — если попытка не completed.
   */
  passed: boolean | null;
  /** Градация за эту попытку (только для зачётных). */
  grade: string | null;
  gradeColor: string | null;
}

/**
 * Строка отчёта — один пользователь.
 *
 * Все массивы слотов имеют длину N+1, где N = attemptsCount типа теста.
 * `null` в массиве — слот не заполнен.
 */
export interface UserReportRow {
  lastName: string;
  firstName: string;

  /** N+1 слотов по основным забегам (isTen = false). */
  attempts: (AttemptReport | null)[];

  /**
   * N+1 слотов по 10m-забегам (isTen = true).
   * Информативно, на итоговый статус и градацию не влияет.
   */
  attempts10m: (AttemptReport | null)[];

  /** Среднее по зачётным основным попыткам. null — если зачётов нет. */
  averageTime: number | null;

  /** Итоговая градация по averageTime. null — если averageTime == null. */
  grade: string | null;
  gradeColor: string | null;

  /** Итоговый статус по основным попыткам (isTen = false). */
  status: ReportStatus;
}
