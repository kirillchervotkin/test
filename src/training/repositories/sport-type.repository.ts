// src/training/repositories/sport-type.repository.ts

import { Injectable, Inject } from '@nestjs/common';
import { YDBError } from '@ydbjs/error';
import { asc, eq, inArray } from 'drizzle-orm';
import {
  YdbUniqueConstraintViolationError,
  type YdbDrizzleDatabase,
} from '@ydbjs/drizzle-adapter';

import { DRIZZLE } from '../../common/ydb/ydb.constants.js';
import { sportTypes } from '../entities/sport-type.schema.js';
import {
  type SportType,
  type CreateSportTypeData,
  type UpdateSportTypeData,
} from '../entities/types/sport-type.types.js';
import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';

type DrizzleDb = YdbDrizzleDatabase;

// ============================================================
// YDB ERROR CODES
// ============================================================
//
// 400120 — нарушение UNIQUE-ограничения.
//
// В этой таблице единственный уникальный ключ — PK (code).
// 400120 может возникнуть в двух случаях:
//   1. create() — клиент прислал code, который уже есть.
//      Это ошибка клиента → транслируем в DbUniqueViolationException.
//   2. Гонка двух параллельных create() на один и тот же code.
//      При idempotent: true YDB перезапустит транзакцию.
//
const YDB_UNIQUE_VIOLATION_CODE = 400120;

@Injectable()
export class SportTypeRepository {
  constructor(@Inject(DRIZZLE) private db: DrizzleDb) {}

  // ============================================================
  // SELECT SHAPE
  // ============================================================
  //
  // В этой таблице все колонки — часть PK или значения.
  // selectShape нужен, чтобы не дублировать список полей
  // в .returning(...).
  //
  private readonly selectShape = {
    code: sportTypes.code,
    displayRu: sportTypes.displayRu,
    displayEn: sportTypes.displayEn,
  } as const;

  // ============================================================
  // ERROR DETECTION
  // ============================================================
  //
  // Три формы проверки — как в test-grade.ydb.repository.
  //
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
  // ============================================================
  //
  // Создаёт новую запись справочника. code — PK, задаётся
  // вызывающим кодом (обычно seed-скриптом).
  //
  // При конфликте по PK транслируем в DbUniqueViolationException:
  // вызывающий код (seed или админ-эндпоинт) должен знать, что
  // такой код уже занят, и решить, что делать (обновить или
  // пропустить).
  //
  // Транзакция с idempotent: true — на случай гонки двух
  // параллельных seed-скриптов.
  //
  async create(data: CreateSportTypeData): Promise<SportType> {
    try {
      return await this.db.transaction(
        async (tx) => {
          const inserted = (await tx
            .insert(sportTypes)
            .values(data)
            .returning(this.selectShape)) as SportType[];

          const row = inserted[0];
          if (!row) {
            throw new Error(`Failed to create sport type ${data.code}`);
          }
          return row;
        },
        { idempotent: true },
      );
    } catch (err) {
      if (this.isDuplicateError(err)) {
        throw new DbUniqueViolationException([
          { dbField: 'code', value: data.code },
        ]);
      }
      throw err;
    }
  }

  // ============================================================
  // UPSERT
  // ============================================================
  //
  // Создаёт или обновляет запись справочника по code.
  //
  // Основной сценарий — seed-скрипт, который наполняет справочник
  // при деплое. Если запись есть — обновляем displayRu/displayEn
  // (например, поменяли перевод), если нет — создаём.
  //
  // В отличие от create(), 400120 здесь НЕ транслируется:
  // это всегда гонка двух seed-скриптов, разрешается через retry.
  //
  async upsert(data: CreateSportTypeData): Promise<SportType> {
    const execute = async (): Promise<SportType> => {
      const existing = (await this.db
        .select({ code: sportTypes.code })
        .from(sportTypes)
        .where(eq(sportTypes.code, data.code))
        .limit(1)) as { code: string }[];

      if (existing.length > 0) {
        const updated = (await this.db
          .update(sportTypes)
          .set({
            displayRu: data.displayRu,
            displayEn: data.displayEn,
          })
          .where(eq(sportTypes.code, data.code))
          .returning(this.selectShape)) as SportType[];

        const row = updated[0];
        if (!row) {
          throw new Error(`Failed to update sport type ${data.code}`);
        }
        return row;
      }

      const inserted = (await this.db
        .insert(sportTypes)
        .values(data)
        .returning(this.selectShape)) as SportType[];

      const row = inserted[0];
      if (!row) {
        throw new Error(`Failed to insert sport type ${data.code}`);
      }
      return row;
    };

    return this.db.transaction(execute, { idempotent: true });
  }

  // ============================================================
  // UPSERT MANY
  // ============================================================
  //
  // Пакетный upsert для seed-скрипта. Одна транзакция на весь
  // набор: либо все записи обновлены/созданы, либо ничего.
  //
  // Возвращает количество обработанных записей.
  //
  async upsertMany(data: CreateSportTypeData[]): Promise<number> {
    if (data.length === 0) return 0;

    return this.db.transaction(
      async (tx) => {
        let written = 0;

        for (const item of data) {
          const existing = (await tx
            .select({ code: sportTypes.code })
            .from(sportTypes)
            .where(eq(sportTypes.code, item.code))
            .limit(1)) as { code: string }[];

          if (existing.length > 0) {
            await tx
              .update(sportTypes)
              .set({
                displayRu: item.displayRu,
                displayEn: item.displayEn,
              })
              .where(eq(sportTypes.code, item.code));
          } else {
            await tx.insert(sportTypes).values(item);
          }

          written++;
        }

        return written;
      },
      { idempotent: true },
    );
  }

  // ============================================================
  // FIND BY CODE
  // ============================================================
  //
  // Lookup по PK. Основной сценарий — проверка существования
  // или чтение одной записи (например, в admin-эндпоинте).
  //
  async findByCode(code: string): Promise<SportType | null> {
    const rows = (await this.db
      .select()
      .from(sportTypes)
      .where(eq(sportTypes.code, code))
      .limit(1)) as SportType[];
    return rows[0] ?? null;
  }

  // ============================================================
  // FIND ALL
  // ============================================================
  //
  // Весь справочник. Сортировка по displayEn — стабильный
  // алфавитный порядок для UI. Используется для:
  //   - выпадающего списка в фильтре тренировок;
  //   - рендеринга списка тренировок (клиент маппит code →
  //     displayRu по этому словарю).
  //
  // Пагинации нет: справочник маленький (десятки записей),
  // разбивать на страницы бессмысленно.
  //
  async findAll(): Promise<SportType[]> {
    return (await this.db
      .select()
      .from(sportTypes)
      .orderBy(asc(sportTypes.displayEn))) as SportType[];
  }

  // ============================================================
  // FIND BY CODES
  // ============================================================
  //
  // Выборка нескольких записей по списку кодов. Используется,
  // когда нужно развернуть displayRu/displayEn только для тех
  // видов спорта, что реально встречаются в выборке тренировок —
  // вместо того чтобы тянуть весь справочник.
  //
  async findByCodes(codes: string[]): Promise<SportType[]> {
    if (codes.length === 0) return [];

    return (await this.db
      .select()
      .from(sportTypes)
      .where(inArray(sportTypes.code, codes))) as SportType[];
  }

  // ============================================================
  // UPDATE
  // ============================================================
  //
  // Обновляет displayRu / displayEn. code не меняется — это PK.
  // Если хочется переименовать код, это делается через DELETE +
  // INSERT + миграцию существующих training_sessions.sport.
  //
  // Возвращает обновлённую запись или null, если code не найден.
  //
  async update(
    code: string,
    data: UpdateSportTypeData,
  ): Promise<SportType | null> {
    if (Object.keys(data).length === 0) {
      return this.findByCode(code);
    }

    const updated = (await this.db
      .update(sportTypes)
      .set(data)
      .where(eq(sportTypes.code, code))
      .returning(this.selectShape)) as SportType[];

    return updated[0] ?? null;
  }

  // ============================================================
  // DELETE
  // ============================================================
  //
  // Удаляет запись справочника. YDB не enforced FK, поэтому
  // тренировки, ссылающиеся на удалённый code через
  // training_sessions.sport, останутся с «висячим» значением.
  //
  // Мы не проверяем ссылки здесь: справочник администрируется
  // вручную, и удаление code — осознанное решение. Если нужна
  // защита от «висячих» ссылок — проверяйте её в сервисе,
  // как это делает TestTypeRepository.delete через
  // result_test_types.
  //
  // Возвращает true, если строка была и удалена; false — если
  // её не было. Повторный вызов идемпотентен.
  //
  async delete(code: string): Promise<boolean> {
    const deleted = (await this.db
      .delete(sportTypes)
      .where(eq(sportTypes.code, code))
      .returning({ code: sportTypes.code })) as { code: string }[];
    return deleted.length > 0;
  }
}
