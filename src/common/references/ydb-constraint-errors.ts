import { YDBError } from '@ydbjs/error';
import { YdbUniqueConstraintViolationError } from '@ydbjs/drizzle-adapter';
import { DbUniqueViolationException } from '../exceptions/db-unique-violation.exception.js';

// YDB also uses PRECONDITION_FAILED for unrelated failures. Do not turn them into 409.
export async function translateUniqueError(
  error: unknown,
  fields: { dbField: string; value?: unknown }[],
  constraintName: string,
): Promise<never> {
  const seen = new Set<unknown>();
  let cause = error;
  while (cause instanceof Error && !seen.has(cause)) {
    seen.add(cause);
    if (cause instanceof DbUniqueViolationException) throw cause;
    if (
      cause instanceof YdbUniqueConstraintViolationError ||
      (cause instanceof YDBError && Number(cause.code) === 400120 &&
        /unique|duplicate|already exists|Constraint violated\. Table:/i.test(cause.message))
    )
      throw new DbUniqueViolationException(fields, constraintName);
    cause = cause.cause;
  }
  return Promise.reject(error);
}
