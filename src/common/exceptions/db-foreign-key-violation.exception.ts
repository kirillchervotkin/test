/**
 * Exception thrown when a database foreign key constraint is violated.
 *
 * This exception is typically raised by the database layer (e.g., YDB, PostgreSQL)
 * when an insert, update, or delete operation would break a referential integrity rule.
 * It carries information about the affected fields and the name of the violated constraint.
 *
 * The `fields` array contains the database column names and their attempted values,
 * which can be used to map back to DTO fields and provide user-friendly error messages.
 */
export class DbForeignKeyViolationException extends Error {
  /**
   * List of fields involved in the foreign key violation.
   * Each entry contains the database field name and the value that was attempted.
   */
  public readonly fields: { dbField: string; value?: unknown }[];

  /**
   * The name of the violated foreign key constraint (optional).
   */
  public readonly constraintName?: string;

  /**
   * Creates a new foreign key violation exception.
   *
   * @param fields - The fields that caused the violation.
   * @param constraintName - The name of the violated constraint (optional).
   */
  constructor(
    fields: { dbField: string; value?: unknown }[],
    constraintName?: string,
  ) {
    super('Foreign key violation');
    this.fields = fields;
    this.constraintName = constraintName;

    // Restore the prototype chain for correct `instanceof` checks
    // (required when extending built-in classes like Error in TypeScript)
    Object.setPrototypeOf(this, DbForeignKeyViolationException.prototype);
  }
}
