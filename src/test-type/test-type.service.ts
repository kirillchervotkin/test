// src/test-types/test-type.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  TestType,
  CreateTestTypeData,
  UpdateTestTypeData,
} from './entities/types/test-type.types.js';
import { TestTypeRepository } from './test-type.repository.js';

/**
 * Service for managing test types.
 *
 * Wraps {@link TestTypeRepository} and provides business-level operations.
 * Translates persistence-layer exceptions into appropriate NestJS exceptions
 * (see global exception filter for HTTP mapping).
 */
@Injectable()
export class TestTypeService {
  constructor(private readonly repository: TestTypeRepository) {}

  /**
   * Creates a new test type.
   *
   * Delegates to the repository, which handles unique constraint violations
   * and throws {@link DbUniqueViolationException} if the name already exists.
   *
   * Согласованность `parameter` ↔ `attemptsCount` уже проверена на уровне
   * `CreateTestTypeDto` (`IsValidAttemptsCount`), поэтому здесь достаточно
   * делегировать в репозиторий.
   *
   * @param data - The data for creating a test type.
   * @returns The newly created {@link TestType}.
   */
  async create(data: CreateTestTypeData): Promise<TestType> {
    return this.repository.create(data);
  }

  /**
   * Retrieves a test type by its ID.
   *
   * Returns `null` if no test type with the given ID exists.
   * This method does not throw an exception – it is the caller's responsibility
   * to decide how to handle a `null` result.
   *
   * @param id - The ID of the test type.
   * @returns The found {@link TestType} or `null`.
   */
  async findById(id: string): Promise<TestType | null> {
    return this.repository.findById(id);
  }

  /**
   * Retrieves all test types for a specific gender.
   *
   * @param gender - The gender to filter by ('male' / 'female').
   * @returns An array of {@link TestType}.
   */
  findByGender(gender: string): Promise<TestType[]> {
    return this.repository.findByGender(gender);
  }

  /**
   * Partially updates a test type.
   *
   * В отличие от `create`, DTO для обновления не видит текущего состояния
   * сущности в БД, поэтому не может проверить применимость `attemptsCount`
   * к итоговому `parameter`. Эта проверка выполняется здесь:
   *
   *   1. читаем текущую сущность;
   *   2. вычисляем «следующее» состояние (merge патча с текущим);
   *   3. проверяем инвариант:
   *        parameter === 'time'  ⟺  attemptsCount != null
   *   4. только после этого пишем патч в БД.
   *
   * @throws {NotFoundException} если записи с данным ID не существует.
   * @throws {BadRequestException} если нарушен инвариант
   *   `parameter` ↔ `attemptsCount`.
   * @param data - The update data containing the ID and fields to update.
   * @returns The updated {@link TestType}.
   */
  async update(data: UpdateTestTypeData): Promise<TestType> {
    const current = await this.repository.findById(data.id);
    if (!current) {
      throw new NotFoundException(`Test type with id ${data.id} not found`);
    }

    // Целевые значения полей с учётом частичного патча.
    // Для `attemptsCount` важно отличать «не передано» (undefined)
    // от «явно обнулено» (null) — см. TestTypeMapper.toUpdateData.
    const nextParameter = data.parameter ?? current.parameter;
    const nextAttemptsCount =
      data.attemptsCount !== undefined
        ? data.attemptsCount
        : current.attemptsCount;

    if (nextParameter === 'time') {
      if (nextAttemptsCount == null) {
        throw new BadRequestException(
          'attemptsCount is required for time tests',
        );
      }
    } else {
      if (nextAttemptsCount != null) {
        throw new BadRequestException(
          'attemptsCount is only applicable to time tests; ' +
            'explicitly set attemptsCount to null when switching away from time',
        );
      }
    }

    const updated = await this.repository.updatePartial(data);
    if (!updated) {
      // Запись могли удалить между findById и updatePartial — трактуем
      // так же, как «не найдено».
      throw new NotFoundException(`Test type with id ${data.id} not found`);
    }
    return updated;
  }

  /**
   * Retrieves all test types with pagination, filtering, and sorting.
   *
   * @param params - Query parameters.
   * @param params.limit - Number of records per page (default: 100).
   * @param params.offset - Number of records to skip (default: 0).
   * @param params.filter - Optional filter by name (partial match) and gender.
   * @param params.orderBy - Field to order by: 'name', 'id', or 'gender' (default: 'name').
   * @param params.orderDir - Sort direction: 'ASC' or 'DESC' (default: 'ASC').
   * @returns An object containing the list of records and total count.
   */
  async findAll(params: {
    limit?: number;
    offset?: number;
    filter?: { name?: string; gender?: string };
    orderBy?: 'name' | 'id' | 'gender';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<{ rows: TestType[]; total: number }> {
    return this.repository.findAll(
      params.limit ?? 100,
      params.offset ?? 0,
      params.filter,
      params.orderBy ?? 'name',
      params.orderDir ?? 'ASC',
    );
  }

  /**
   * Deletes a test type by its ID.
   *
   * The repository checks for existing references in the `result_test_types`
   * table inside a transaction. If references exist, it throws
   * {@link DbForeignKeyViolationException}. If the record does not exist, the
   * repository returns `null`, and this method throws a {@link NotFoundException}.
   *
   * @throws {NotFoundException} if the test type with the given ID does not exist.
   * @throws {DbForeignKeyViolationException} if the test type is referenced by one or more results.
   * @param id - The ID of the test type to delete.
   */
  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Test type with id ${id} not found`);
    }
    // Foreign key violations are thrown by the repository and propagated up.
  }
}
