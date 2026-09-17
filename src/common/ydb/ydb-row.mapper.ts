import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

type ClassConstructor<T> = new (...args: unknown[]) => T;

/**
 * Mapper service that transforms raw YDB result sets into typed class instances.
 * It expects the YDB response to be an array where the first element is an array of rows
 * (each row being a plain object). Only the first result set is used.
 *
 * The mapping uses `class-transformer` and `class-validator` to apply
 * transformation decorators and to perform synchronous validation.
 */
@Injectable()
export class YdbRowMapper {
  /**
   * Extracts the first row from the YDB result set and maps it to an instance of the given class.
   * If no rows are present, returns `null`.
   *
   * @param resultSets - The raw YDB response (expected to be an array of result sets).
   * @param cls - The target class constructor.
   * @returns An instance of the class or `null` if the result set is empty.
   */
  extractOne<T extends object>(
    resultSets: unknown,
    cls: ClassConstructor<T>,
  ): T | null {
    const rows = this.getRows(resultSets);
    if (rows.length === 0) return null;
    return this.map(rows[0], cls);
  }

  /**
   * Extracts all rows from the YDB result set and maps each to an instance of the given class.
   * Returns an empty array if there are no rows.
   *
   * @param resultSets - The raw YDB response.
   * @param cls - The target class constructor.
   * @returns An array of class instances.
   */
  extractMany<T extends object>(
    resultSets: unknown,
    cls: ClassConstructor<T>,
  ): T[] {
    const rows = this.getRows(resultSets);
    return rows.map((row) => this.map(row, cls));
  }

  // ---------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------

  /**
   * Type guard that checks whether the provided value has the expected structure:
   * an array where the first element is an array of row objects.
   *
   * This aligns with the simplified YDB response format used in this application.
   * In a full YDB SDK, the response might contain additional metadata,
   * but here we only handle the rows themselves.
   */
  private isResultSets(value: unknown): value is [Record<string, unknown>[]] {
    return Array.isArray(value) && value.length > 0 && Array.isArray(value[0]);
  }

  /**
   * Safely extracts the row array from the raw YDB response.
   * Throws an error if the response does not match the expected structure.
   *
   * @param resultSets - The raw response from YDB.
   * @returns The array of rows from the first result set.
   */
  private getRows(resultSets: unknown): Record<string, unknown>[] {
    if (!this.isResultSets(resultSets)) {
      throw new Error('Invalid database response: expected an array of arrays');
    }
    // After the type guard, resultSets is typed as [Record<string, unknown>[]]
    return resultSets[0];
  }

  /**
   * Transforms a raw database row object into an instance of the target class
   * using `plainToInstance`, then performs synchronous validation.
   * If validation fails, an error with detailed messages is thrown.
   *
   * @param row - A plain object representing a single row.
   * @param cls - The target class constructor.
   * @returns An instance of the class.
   */
  private map<T extends object>(
    row: Record<string, unknown>,
    cls: ClassConstructor<T>,
  ): T {
    const instance = plainToInstance(cls, row);
    const errors = validateSync(instance);

    if (errors.length > 0) {
      const errorMessages = errors
        .filter((error) => !!error.constraints)
        .map((error) => {
          const constraintKeys = Object.keys(error.constraints ?? {});
          const constraintValues = Object.values(error.constraints ?? {});
          return `${constraintKeys[0]}: ${constraintValues[0]}`;
        })
        .join('\n');
      throw new Error(`Validation failed:\n${errorMessages}`);
    }

    return instance;
  }
}
