// src/test-grades/repository/test-grade.ydb.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { YDBError } from '@ydbjs/error';
import { v4 as uuidv4 } from 'uuid';
import { eq, and, asc, inArray } from 'drizzle-orm';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { testGrades } from '../entities/test-grades.schema.js';
import { testTypes } from '../../test-type/entities/test-type.schema.js';

import {
  TestGrade,
  CreateTestGradeData,
} from '../entities/types/test-grade.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../../common/exceptions/db-foreign-key-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;
type DrizzleTx = Parameters<Parameters<DrizzleDb['transaction']>[0]>[0];
type DrizzleRunner = DrizzleDb | DrizzleTx;

/** Поля, которые разрешено менять у существующей градации. */
export type TestGradePatch = Partial<
  Pick<TestGrade, 'grade' | 'threshold' | 'color'>
>;

/** Вход для applyDiff: что создать / обновить / удалить. */
export type TestGradeDiff = {
  create: Array<Omit<CreateTestGradeData, 'testTypeId'>>;
  update: Array<{ id: string } & TestGradePatch>;
  delete: string[];
};

/**
 * Контекст для трансляции ошибки записи.
 *
 * `grade` присутствует ТОЛЬКО если запись трогала PK-колонку `grade`.
 * Это единственное, что нужно знать для корректной трансляции:
 *
 *   - `grade` задан     → нарушение PK (test_type_id, grade);
 *   - `grade` не задан  → мы не меняли ни PK-колонку, ни `id`
 *     (единственный unique-индекс помимо PK), и 400120 от YDB
 *     в норме прийти не может. Считаем это неожиданностью и
 *     пробрасываем исходную ошибку как есть, чтобы её было видно
 *     в логах и она не маскировалась под «градация уже есть».
 */
type WriteErrorContext = {
  testTypeId: string;
  grade?: string;
};

// ============================================================
// YDB ERROR CODES
// ============================================================
//
// 400120 — нарушение UNIQUE-ограничения.
//
// Кода FK-violation нет: YDB не enforced FK на уровне движка,
// поэтому нарушение ловим пред-проверкой ensureTestTypeExists.
//
const YDB_UNIQUE_VIOLATION_CODE = 400120;

@Injectable()
export class TestGradeYdbRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  // INTERNAL HELPERS
  // ============================================================

  private readonly selectShape = {
    id: testGrades.id,
    testTypeId: testGrades.testTypeId,
    grade: testGrades.grade,
    threshold: testGrades.threshold,
    color: testGrades.color,
  } as const;

  /**
   * Проверяет существование родителя (test_types).
   *
   * YDB не enforced FK, поэтому единственный способ поймать
   * нарушение — самим убедиться, что родитель есть.
   *
   * ВАЖНО: вызывать строго в той же транзакции, что и запись.
   * Благодаря SERIALIZABLE-изоляции YDB и оптимистичным блокировкам,
   * если параллельная транзакция удалит test_type между нашим
   * SELECT и INSERT, конфликт будет обнаружен на коммите, и одна
   * из транзакций будет прервана с retryable-ошибкой. При
   * idempotent: true адаптер автоматически перезапустит транзакцию.
   */
  private async ensureTestTypeExists(
    testTypeId: string,
    runner: DrizzleRunner,
  ): Promise<void> {
    const rows = (await runner
      .select({ id: testTypes.id })
      .from(testTypes)
      .where(eq(testTypes.id, testTypeId))
      .limit(1)) as { id: string }[];

    if (rows.length === 0) {
      throw new DbForeignKeyViolationException([
        { dbField: 'test_type_id', value: testTypeId },
      ]);
    }
  }

  // ============================================================
  // ERROR DETECTION
  // ============================================================

  /**
   * Проверяет, что ошибка от YDB — это нарушение UNIQUE.
   *
   * Проверяем три формы, потому что в разных версиях адаптера и в
   * разных слоях обёрток ошибка может прийти по-разному:
   *   1) типизированный класс;
   *   2) YDBError с кодом 400120;
   *   3) Error с cause = YDBError(400120) — обёрнутая ошибка.
   */
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
  // ERROR TRANSLATION
  //
  // Трансляция — чистый catch-only механизм. Никаких SELECT-ов
  // перед записью (уникальность обеспечивает YDB) и никакой
  // пост-диагностики через БД:
  //
  //   - SELECT после неудачи бесполезен: транзакция в YDB могла
  //     быть аборчена, и запросы в ней упадут по другой причине.
  //   - SELECT мог бы вернуть самосовпадение (UPDATE по строке, не
  //     меняющий grade, «находит» эту же строку), что порождало
  //     ложное «уникальность нарушена» — ровно тот баг, из-за
  //     которого всплыло «Комбинация полей уже существует» при
  //     изменении одного порога.
  //
  // Всё, что нужно, известно из контекста вызова:
  //   - какой test_type_id пишем (параметр);
  //   - трогали ли PK-колонку grade (grade в патче или нет).
  // ============================================================

  private translateWriteError(err: unknown, ctx: WriteErrorContext): never {
    if (!this.isDuplicateError(err)) {
      // Не наш случай — пробрасываем как есть.
      throw err;
    }

    if (ctx.grade !== undefined) {
      // Писали в grade → могли нарушить PK (test_type_id, grade).
      throw new DbUniqueViolationException([
        { dbField: 'test_type_id', value: ctx.testTypeId },
        { dbField: 'grade', value: ctx.grade },
      ]);
    }

    // YDB бросил 400120, но grade в патче не было. Такого в норме
    // не бывает: без изменения PK-колонки (grade) и без изменения
    // idx_id (id) дубликат создать неоткуда. Значит, либо баг в
    // коде, либо новая неожиданная причина 400120. Пробрасываем
    // исходную ошибку, чтобы её не замаскировать под «градация
    // уже есть» и увидеть в логах.
    throw err;
  }

  // ============================================================
  // CREATE (single)
  //
  // Всегда выполняется в транзакции: либо в переданной снаружи,
  // либо в собственной. Это нужно, чтобы ensureTestTypeExists и
  // insert были в одном снапшоте и не разъезжались по времени.
  //
  // idempotent: true — при конфликте блокировок YDB автоматически
  // перезапустит транзакцию. При повторном выполнении SELECT
  // уже не найдёт удалённый test_type → DbForeignKeyViolationException.
  // ============================================================
  async create(data: CreateTestGradeData, tx?: DrizzleTx): Promise<TestGrade> {
    const id = uuidv4();

    const execute = async (runner: DrizzleRunner): Promise<TestGrade> => {
      // 1. Проверка FK — ВНУТРИ транзакции, в одном снапшоте с insert.
      await this.ensureTestTypeExists(data.testTypeId, runner);

      // 2. INSERT
      try {
        const rows = (await runner
          .insert(testGrades)
          .values({ id, ...data })
          .returning(this.selectShape)) as TestGrade[];

        const [newRow] = rows;
        if (!newRow) throw new Error('Failed to create test grade');
        return newRow;
      } catch (err) {
        this.translateWriteError(err, {
          testTypeId: data.testTypeId,
          grade: data.grade,
        });
      }
    };

    if (tx) return execute(tx);
    return this.db.transaction(execute, { idempotent: true });
  }

  // ============================================================
  // UPDATE BY ID
  // Разрешено менять grade, threshold, color. testTypeId — нельзя.
  // ============================================================
  async updateById(
    id: string,
    data: TestGradePatch,
    tx?: DrizzleTx,
  ): Promise<TestGrade | null> {
    const runner = tx ?? this.db;
    if (Object.keys(data).length === 0) return this.findById(id, tx);

    const current = await this.findById(id, tx);
    if (!current) return null;

    try {
      const rows = (await runner
        .update(testGrades)
        .set(data)
        .where(eq(testGrades.id, id))
        .returning(this.selectShape)) as TestGrade[];
      return rows[0] ?? null;
    } catch (err) {
      this.translateWriteError(err, {
        testTypeId: current.testTypeId,
        grade: data.grade, // undefined, если grade не трогали
      });
    }
  }

  // ============================================================
  // UPDATE BY ID AND TEST TYPE
  //
  // Compound-версия updateById: test_type_id входит в WHERE.
  // Используется в REST-обёртке, где URL содержит :testTypeId и
  // клиент не должен мочь обновить градацию чужого типа теста.
  //
  // Существующий updateById остаётся для внутренних нужд
  // (applyDiff, диагностика) — там testTypeId известен из контекста
  // и дублировать его в WHERE не обязательно.
  // ============================================================
  async updateByIdAndTestType(
    id: string,
    testTypeId: string,
    data: TestGradePatch,
    tx?: DrizzleTx,
  ): Promise<TestGrade | null> {
    const runner = tx ?? this.db;
    if (Object.keys(data).length === 0) {
      return this.findByIdAndTestType(id, testTypeId, tx);
    }

    try {
      const rows = (await runner
        .update(testGrades)
        .set(data)
        .where(
          and(eq(testGrades.id, id), eq(testGrades.testTypeId, testTypeId)),
        )
        .returning(this.selectShape)) as TestGrade[];
      return rows[0] ?? null;
    } catch (err) {
      // Всё, что нужно для трансляции, известно из параметров:
      // testTypeId — из URL, grade — из патча (если он там был).
      // Никаких SELECT-ов после ошибки.
      this.translateWriteError(err, {
        testTypeId,
        grade: data.grade,
      });
    }
  }

  // ============================================================
  // DELETE BY ID
  // ============================================================
  async deleteById(id: string, tx?: DrizzleTx): Promise<TestGrade | null> {
    const runner = tx ?? this.db;
    const rows = (await runner
      .delete(testGrades)
      .where(eq(testGrades.id, id))
      .returning(this.selectShape)) as TestGrade[];
    return rows[0] ?? null;
  }

  // ============================================================
  // DELETE BY ID AND TEST TYPE
  //
  // Compound-версия deleteById: test_type_id входит в WHERE.
  // Если градация не принадлежит указанному типу теста — вернёт
  // null (ничего не удалено).
  // ============================================================
  async deleteByIdAndTestType(
    id: string,
    testTypeId: string,
    tx?: DrizzleTx,
  ): Promise<TestGrade | null> {
    const runner = tx ?? this.db;
    const rows = (await runner
      .delete(testGrades)
      .where(and(eq(testGrades.id, id), eq(testGrades.testTypeId, testTypeId)))
      .returning(this.selectShape)) as TestGrade[];
    return rows[0] ?? null;
  }

  // ============================================================
  // DELETE ALL BY TEST TYPE
  // Каскад при удалении типа теста.
  // ============================================================
  async deleteAllByTestType(testTypeId: string, tx?: DrizzleTx): Promise<void> {
    const runner = tx ?? this.db;
    await runner
      .delete(testGrades)
      .where(eq(testGrades.testTypeId, testTypeId));
  }

  // ============================================================
  // FIND BY ID
  // ============================================================
  async findById(id: string, tx?: DrizzleRunner): Promise<TestGrade | null> {
    const runner = tx ?? this.db;
    const rows = (await runner
      .select()
      .from(testGrades)
      .where(eq(testGrades.id, id))
      .limit(1)) as TestGrade[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND BY ID AND TEST TYPE
  //
  // Compound-версия findById: test_type_id входит в WHERE.
  // Один запрос вместо «найти по id → сверить поле». Гарантирует,
  // что результат и URL согласованы: если градация принадлежит
  // другому типу — вернётся null.
  // ============================================================
  async findByIdAndTestType(
    id: string,
    testTypeId: string,
    tx?: DrizzleRunner,
  ): Promise<TestGrade | null> {
    const runner = tx ?? this.db;
    const rows = (await runner
      .select()
      .from(testGrades)
      .where(and(eq(testGrades.id, id), eq(testGrades.testTypeId, testTypeId)))
      .limit(1)) as TestGrade[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND ALL BY TEST TYPE
  // ============================================================
  async findAllByTestType(
    testTypeId: string,
    tx?: DrizzleTx,
  ): Promise<TestGrade[]> {
    const runner = tx ?? this.db;
    return (await runner
      .select()
      .from(testGrades)
      .where(eq(testGrades.testTypeId, testTypeId))
      .orderBy(asc(testGrades.threshold))) as TestGrade[];
  }

  // ============================================================
  // APPLY DIFF (batched)
  // Применяет набор изменений к градациям одного типа теста
  // атомарно. Порядок: delete → update → create.
  //
  // Почему именно такой порядок:
  //   - если фронт удалил grade "B" и создал новый grade "B" с
  //     другими полями, при обратном порядке получим PK-violation;
  //   - если фронт переименовал "A" → "B" и удалил старый "B",
  //     при обратном порядке тоже получим PK-violation.
  //
  // Проверка родителя выполняется ВНУТРИ транзакции, в одном
  // снапшоте с записью — это ключевое отличие от предыдущих версий.
  // ============================================================
  async applyDiff(
    testTypeId: string,
    diff: TestGradeDiff,
    tx?: DrizzleTx,
  ): Promise<TestGrade[]> {
    // Внутренние дубликаты grade среди create — отсекаем до БД.
    // Это чисто клиентская ошибка (в одном и том же diff два
    // create с одинаковым grade), YDB о ней не узнает, потому
    // что до неё дойдёт только первая вставка... точнее, узнает,
    // но без внятной привязки к конкретной паре. Отсекаем сами.
    const createdGrades = new Set<string>();
    for (const c of diff.create) {
      if (createdGrades.has(c.grade)) {
        throw new DbUniqueViolationException([
          { dbField: 'test_type_id', value: testTypeId },
          { dbField: 'grade', value: c.grade },
        ]);
      }
      createdGrades.add(c.grade);
    }

    const execute = async (runner: DrizzleRunner): Promise<TestGrade[]> => {
      // 1. Проверка FK — ВНУТРИ транзакции, в одном снапшоте с записью.
      await this.ensureTestTypeExists(testTypeId, runner);

      // 2. DELETE
      // Удаление не может нарушить unique-ограничение — не оборачиваем.
      if (diff.delete.length > 0) {
        await runner
          .delete(testGrades)
          .where(
            and(
              eq(testGrades.testTypeId, testTypeId),
              inArray(testGrades.id, diff.delete),
            ),
          );
      }

      // 3. UPDATE
      for (const u of diff.update) {
        const { id, ...patch } = u;
        if (Object.keys(patch).length === 0) continue;

        try {
          await runner
            .update(testGrades)
            .set(patch)
            .where(
              and(eq(testGrades.id, id), eq(testGrades.testTypeId, testTypeId)),
            );
        } catch (err) {
          this.translateWriteError(err, {
            testTypeId,
            grade: patch.grade, // undefined, если grade не меняли
          });
        }
      }

      // 4. CREATE
      if (diff.create.length > 0) {
        const insertData = diff.create.map((c) => ({
          ...c,
          testTypeId,
          id: uuidv4(),
        }));

        try {
          await runner.insert(testGrades).values(insertData);
        } catch (err) {
          // Batch-вставка не говорит, какая именно строка конфликтует.
          // Для репортинга берём первую — как «наиболее вероятную»
          // (обычно клиент пачкой добавляет одну-две градации, и
          // если конфликт есть, он чаще всего в первой). Это
          // компромисс: SELECT после ошибки, чтобы найти виновника,
          // не делаем — принцип «не диагностировать через БД».
          const first = diff.create[0];
          this.translateWriteError(err, {
            testTypeId,
            grade: first.grade,
          });
        }
      }

      // 5. Возвращаем актуальный набор целиком.
      return (await runner
        .select()
        .from(testGrades)
        .where(eq(testGrades.testTypeId, testTypeId))
        .orderBy(asc(testGrades.threshold))) as TestGrade[];
    };

    if (tx) return execute(tx);
    return this.db.transaction(execute, { idempotent: true });
  }
}
