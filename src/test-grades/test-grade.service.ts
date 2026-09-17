// src/test-grades/test-grade.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  TestGrade,
  CreateTestGradeData,
} from './entities/types/test-grade.types.js';
import {
  TestGradeYdbRepository,
  TestGradeDiff,
  TestGradePatch,
} from './repository/test-grade.ydb.repository.js';

/**
 * Сервис управления градациями тестов.
 *
 * Тонкая обёртка над {@link TestGradeYdbRepository}. Вся работа с БД
 * (транзакции, проверки FK, обработка unique-violation, retry через
 * `idempotent: true`) инкапсулирована в репозитории — сервис не
 * инжектит `DRIZZLE` и не открывает транзакции.
 *
 * Сервис добавляет только бизнес-семантику: перевод `null` в
 * {@link NotFoundException}. Исключения уровня БД
 * (`DbUniqueViolationException`, `DbForeignKeyViolationException`)
 * не трогаются — они транслируются в HTTP глобальным фильтром.
 *
 * Методы `*InType` принимают `testTypeId` отдельно — это
 * соответствует иерархии URL `test-types/:testTypeId/grades`.
 * Гарантия принадлежности градации типу теста обеспечивается на
 * уровне репозитория (`WHERE id AND test_type_id`), а не
 * пост-проверкой в сервисе.
 */
@Injectable()
export class TestGradeService {
  constructor(private readonly repository: TestGradeYdbRepository) {}

  // ============================================================
  // CREATE (single)
  //
  // Репозиторий сам открывает транзакцию, проверяет родителя
  // (test_types) и делает INSERT. При нарушении FK/unique бросает
  // Db*ViolationException — фильтр превратит в 4xx.
  // ============================================================
  async create(data: CreateTestGradeData): Promise<TestGrade> {
    return this.repository.create(data);
  }

  // ============================================================
  // APPLY DIFF (batched)
  //
  // Основная операция редактора набора: применяет create / update /
  // delete к градациям одного типа теста атомарно.
  // Порядок внутри транзакции: delete → update → create.
  // Возвращает актуальный набор целиком (с новыми id созданных).
  // ============================================================
  async applyDiff(
    testTypeId: string,
    diff: TestGradeDiff,
  ): Promise<TestGrade[]> {
    return this.repository.applyDiff(testTypeId, diff);
  }

  // ============================================================
  // FIND ALL BY TEST TYPE
  //
  // Возвращает градации одного типа теста, отсортированные по
  // threshold (естественный порядок отображения).
  // ============================================================
  async findAllByTestType(testTypeId: string): Promise<TestGrade[]> {
    return this.repository.findAllByTestType(testTypeId);
  }

  // ============================================================
  // FIND BY ID IN TEST TYPE
  //
  // Возвращает `null`, если градация не найдена ИЛИ принадлежит
  // другому типу теста. Контроллер сам решает, что с этим делать
  // (обычно — NotFoundException).
  //
  // Проверка принадлежности — на уровне репозитория, одним запросом
  // с `WHERE id AND test_type_id`. Пост-проверки в сервисе нет.
  // ============================================================
  async findByIdInType(
    testTypeId: string,
    gradeId: string,
  ): Promise<TestGrade | null> {
    return this.repository.findByIdAndTestType(gradeId, testTypeId);
  }

  // ============================================================
  // UPDATE BY ID IN TEST TYPE
  //
  // Разрешено менять grade, threshold, color. testTypeId — нельзя:
  // «переезд» градации в другой тип теста — это delete + create.
  //
  // Бросает NotFoundException, если градации нет или она не
  // принадлежит этому типу теста.
  // Бросает DbUniqueViolationException, если новый grade конфликтует
  // с существующим PK (test_type_id, grade).
  // ============================================================
  async updateByIdInType(
    testTypeId: string,
    gradeId: string,
    data: TestGradePatch,
  ): Promise<TestGrade> {
    const updated = await this.repository.updateByIdAndTestType(
      gradeId,
      testTypeId,
      data,
    );
    if (!updated) {
      throw new NotFoundException(
        `Test grade with id ${gradeId} not found in test type ${testTypeId}`,
      );
    }
    return updated;
  }

  // ============================================================
  // DELETE BY ID IN TEST TYPE
  //
  // Бросает NotFoundException, если градации нет или она не
  // принадлежит этому типу теста.
  // ============================================================
  async deleteByIdInType(testTypeId: string, gradeId: string): Promise<void> {
    const deleted = await this.repository.deleteByIdAndTestType(
      gradeId,
      testTypeId,
    );
    if (!deleted) {
      throw new NotFoundException(
        `Test grade with id ${gradeId} not found in test type ${testTypeId}`,
      );
    }
  }
}
