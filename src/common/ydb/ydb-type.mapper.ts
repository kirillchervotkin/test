import { Injectable } from '@nestjs/common';
import { Optional } from '@ydbjs/value/optional';
import {
  Text,
  Datetime,
  Bool,
  TextType,
  DateType,
  Uuid,
  Date as YdbDate,
  Uint64,
} from '@ydbjs/value/primitive';

/**
 * Service that maps plain JavaScript/TypeScript values to YDB primitive types
 * using the `@ydbjs/value` library. This is useful for building typed parameters
 * for YDB queries (e.g., prepared statements with parameter placeholders).
 *
 * YDB supports various data types including:
 * - `Uuid` – universally unique identifier
 * - `Text` – UTF-8 string (corresponds to YDB's `Utf8` or `Text` type)
 * - `Bool` – boolean
 * - `Datetime` – date and time (with microsecond precision)
 * - `Date` – date only
 * - `Optional` – wrapper for nullable values of a specific type
 *
 * All methods are synchronous and perform no validation beyond type checking.
 */
@Injectable()
export class YdbTypeMapper {
  /**
   * Ensures that the provided value is an array of plain objects.
   * Throws an error if the structure is invalid.
   * This is typically used to validate data before bulk insert operations
   * where each item represents a row to be inserted.
   *
   * @param array - The value to check.
   * @returns The same array but with a narrowed type.
   * @throws {Error} If the value is not an array or any element is not a non‑null object.
   */
  public ensureArrayOfObjects(array: unknown): Record<string, unknown>[] {
    if (!Array.isArray(array)) {
      throw new Error('Invalid data structure: expected an array');
    }

    for (const item of array) {
      if (typeof item !== 'object' || item === null) {
        throw new Error('Invalid data structure: expected objects in array');
      }
    }

    return array as Record<string, unknown>[];
  }

  /**
   * Converts a string UUID to a YDB `Uuid` instance.
   * The input must be a valid UUID string (e.g., "123e4567-e89b-12d3-a456-426614174000").
   *
   * @param value - The UUID string.
   * @returns A `Uuid` instance.
   */
  public toUuid(value: string): Uuid {
    return new Uuid(value);
  }

  /**
   * Converts a string to a YDB `Text` instance.
   * The string will be stored as UTF-8 in YDB.
   *
   * @param value - The string value.
   * @returns A `Text` instance.
   */
  public toText(value: string): Text {
    return new Text(value);
  }

  /**
   * Converts a boolean value to a YDB `Bool` instance.
   *
   * @param value - The boolean value.
   * @returns A `Bool` instance.
   */
  public toBool(value: boolean): Bool {
    return new Bool(value);
  }

  /**
   * Converts a value to a YDB `Datetime` instance.
   * Accepts a string, number (timestamp), or a `Date` object.
   * The resulting `Datetime` represents a point in time with microsecond precision.
   *
   * @param value - The date/time value.
   * @returns A `Datetime` instance.
   */
  public toDatetime(value: string | number | Date): Datetime {
    const date = value instanceof Date ? value : new Date(value);
    return new Datetime(date);
  }

  /**
   * Converts an optional string value to a YDB `Optional<TextType>`.
   * If the input is `null` or `undefined`, the optional will be empty (null).
   * Otherwise, it wraps the string in a `Text` instance and a `TextType` descriptor.
   *
   * @param value - The string or nullable value.
   * @returns An `Optional` containing either a `Text` or null.
   */
  public toOptionalText(value?: string | null): Optional<TextType> {
    if (value != null) {
      return new Optional(new Text(value), new TextType());
    }
    return new Optional(null, new TextType());
  }

  /**
   * Converts an optional date value to a YDB `Optional<DateType>`.
   * Accepts a string, number, `Date`, or null/undefined.
   * If the input is `null` or `undefined`, the optional will be empty (null).
   * Otherwise, it creates a `Date` instance (from the input) and wraps it
   * together with a `DateType` descriptor.
   *
   * @param value - The date value or nullable.
   * @returns An `Optional` containing either a YDB `Date` or null.
   */
  public toOptionalDate(
    value?: string | number | Date | null,
  ): Optional<DateType> {
    if (value != null) {
      const date = value instanceof Date ? value : new Date(value);
      return new Optional(new YdbDate(date), new DateType());
    }
    return new Optional(null, new DateType());
  }

  public toUint64(value: number): Uint64 {
    return new Uint64(BigInt(value));
  }
}
