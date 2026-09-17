import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { I18nService } from 'nestjs-i18n';
import {
  InvalidParam,
  ProblemDetails,
  ValidationErrorItem,
} from '../interfaces/exception.interface.js';
import { ExceptionUtilsService } from './exception-utils.service.js';
import { mappingStorage } from '../middlwares/context.js';
import { DbUniqueViolationException } from '../exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../exceptions/db-foreign-key-violation.exception.js';

/**
 * Exception filter that catches generic `Error` instances and processes
 * database constraint violations (unique and foreign key).
 *
 * It extracts the underlying constraint exception (either `DbUniqueViolationException`
 * or `DbForeignKeyViolationException`) from the error chain (via `cause`),
 * builds a Problem Details response (RFC 7807), and sends it to the client.
 *
 * The filter uses:
 * - Column mapping and validation messages from the async context (`mappingStorage`)
 * - i18n translations for user-facing error messages
 * - Different HTTP status codes and error types depending on the constraint type
 *   and the HTTP method (e.g., DELETE on a referenced resource returns 409 Conflict)
 */
@Injectable()
@Catch(Error)
export class DbConstraintExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Logger,
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly exceptionUtils: ExceptionUtilsService,
    private readonly i18n: I18nService,
  ) {}

  async catch(error: Error, host: ArgumentsHost): Promise<void> {
    // ---- Extract the target exception from the wrapper ----
    let targetError = error;

    // Safely check for the presence of a `cause` field (compatible with older ES versions)
    if (error && typeof error === 'object' && 'cause' in error) {
      const cause = (error as { cause?: unknown }).cause;
      if (cause) {
        // Primary path: using instanceof
        if (
          cause instanceof DbUniqueViolationException ||
          cause instanceof DbForeignKeyViolationException
        ) {
          targetError = cause;
        }
        // Fallback for cases where instanceof fails (e.g., different module contexts)
        else if (
          typeof cause === 'object' &&
          cause !== null &&
          'fields' in cause &&
          'constraintName' in cause
        ) {
          targetError = cause as unknown as
            | DbUniqueViolationException
            | DbForeignKeyViolationException;
        }
      }
    }

    // Delegate unrelated exceptions to Nest instead of rejecting the filter promise.
    if (
      !(targetError instanceof DbUniqueViolationException) &&
      !(targetError instanceof DbForeignKeyViolationException)
    ) {
      new BaseExceptionFilter(this.httpAdapterHost.httpAdapter).catch(
        error,
        host,
      );
      return;
    }

    // ---- Now we can work with the target exception ----
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Retrieve column mapping and validation messages from the async context
    const store = mappingStorage.getStore();
    const columnMapping = store?.columnMapping ?? {};
    const validationMessages = store?.validationMessages ?? {};

    const baseUrl = this.exceptionUtils.buildBaseUrl(request);
    const lang = request.headers['accept-language']?.split(',')[0] ?? 'en';

    const fields = targetError.fields.map((f) => f.dbField);
    const values = targetError.fields.map((f) => f.value ?? '');
    const isComposite = fields.length > 1;
    const constraintName = targetError.constraintName;

    const groupedErrors: Record<
      string,
      { name: string; errors: ValidationErrorItem[] }
    > = {};
    let status = 400;
    let typeUrl: string | undefined;
    let title = 'Constraint violation';
    let detail = 'A database constraint was violated.';
    let includeInvalidParams = true;

    const addErrorItem = (
      fieldName: string,
      item: ValidationErrorItem,
    ): void => {
      if (!groupedErrors[fieldName]) {
        groupedErrors[fieldName] = { name: fieldName, errors: [] };
      }
      groupedErrors[fieldName].errors.push(item);
    };

    const isUnique = targetError instanceof DbUniqueViolationException;
    const isForeignKey = targetError instanceof DbForeignKeyViolationException;

    // --- Handle foreign key violation on DELETE (resource in use) ---
    if (isForeignKey && request.method === 'DELETE') {
      status = 409;
      typeUrl = `${baseUrl}/errors/resource-in-use`;
      title = 'Resource In Use';
      detail =
        'The resource cannot be deleted because it is referenced by other resources.';
      includeInvalidParams = false;
    }
    // --- Handle unique constraint violations ---
    else if (isUnique) {
      if (fields.length === 0) {
        // No field information – internal error (should not happen)
        status = 500;
        typeUrl = `${baseUrl}/errors/internal-error`;
        title = 'Internal Server Error';
        detail = 'Unable to identify the field causing the unique violation.';
        includeInvalidParams = false;
        this.logger.error(
          `DbUniqueViolationException with empty fields: ${targetError.message}`,
        );
      } else {
        status = 409;
        typeUrl = isComposite
          ? `${baseUrl}/errors/composite-unique-violation`
          : `${baseUrl}/errors/unique-violation`;

        for (let i = 0; i < fields.length; i++) {
          const dbField = fields[i];
          const value = values[i];
          const dtoField =
            columnMapping[dbField] ?? this.exceptionUtils.snakeToCamel(dbField);
          const source = this.exceptionUtils.determineSource(dbField, request);

          const fieldMessages = validationMessages[dtoField];
          const fallbackTemplate = isComposite
            ? `Value '{value}' for field '{field}' violates a composite unique constraint.`
            : `Value '{value}' for field '{field}' already exists.`;

          let i18nKey: string | undefined;
          if (isComposite) {
            i18nKey =
              fieldMessages?.uniqueComposite ??
              fieldMessages?.unique?.replace('UNIQUE', 'UNIQUE_COMPOSITE') ??
              'validation.UNIQUE_COMPOSITE';
          } else {
            i18nKey = fieldMessages?.unique ?? 'validation.UNIQUE';
          }

          const reason = await this.translateWithFallback(
            i18nKey,
            lang,
            { field: dtoField, value },
            fallbackTemplate,
          );

          const errorItem: ValidationErrorItem = {
            reason,
            code: isComposite
              ? 'COMPOSITE_UNIQUE_VIOLATION'
              : 'UNIQUE_VIOLATION',
            source,
            ...(isComposite && { compositeGroup: constraintName }),
          };
          addErrorItem(dtoField, errorItem);
        }
      }
    }
    // --- Handle foreign key violations (except DELETE, already handled above) ---
    else if (isForeignKey) {
      if (fields.length === 0) {
        // No field information – internal error
        status = 500;
        typeUrl = `${baseUrl}/errors/internal-error`;
        title = 'Internal Server Error';
        detail =
          'Unable to identify the field causing the foreign key violation.';
        includeInvalidParams = false;
        this.logger.error(
          `DbForeignKeyViolationException with empty fields: ${targetError.message}`,
        );
      } else {
        status = 422;
        typeUrl = `${baseUrl}/errors/foreign-key-violation`;
        title = 'Foreign key constraint violation';
        detail =
          'The request contains invalid data. See "invalid_params" for details.';

        for (let i = 0; i < fields.length; i++) {
          const dbField = fields[i];
          const value = values[i];
          const dtoField =
            columnMapping[dbField] ?? this.exceptionUtils.snakeToCamel(dbField);
          const source = this.exceptionUtils.determineSource(dbField, request);

          const fieldMessages = validationMessages[dtoField];
          const fallbackTemplate = `Referenced record does not exist ({field}={value}).`;
          const i18nKey = fieldMessages?.foreignKey ?? undefined;

          const reason = await this.translateWithFallback(
            i18nKey,
            lang,
            { field: dtoField, value },
            fallbackTemplate,
          );

          const errorItem: ValidationErrorItem = {
            reason,
            code: 'REFERENCE_NOT_FOUND',
            source,
          };
          addErrorItem(dtoField, errorItem);
        }
      }
    }
    // --- Fallback (theoretically unreachable) ---
    else {
      const unknownError = targetError as unknown as Error;
      status = 500;
      typeUrl = `${baseUrl}/errors/database-error`;
      title = 'Database Error';
      detail = 'An unexpected database error occurred.';
      includeInvalidParams = false;
      this.logger.error(`Unknown constraint error: ${unknownError.message}`);
      addErrorItem('database', {
        reason: unknownError.message,
        code: 'UNKNOWN_CONSTRAINT',
      });
    }

    // If we expected to include invalid_params but none were added, add a generic one
    if (includeInvalidParams && Object.keys(groupedErrors).length === 0) {
      addErrorItem('database', {
        reason: targetError.message,
        code: 'UNKNOWN',
      });
    }

    const invalidParams: InvalidParam[] = Object.values(groupedErrors);
    const isDevelopment = process.env.NODE_ENV === 'development';

    const problemDetails: ProblemDetails = {
      type: typeUrl || 'about:blank',
      title,
      status,
      instance: request.url,
      detail,
      ...(includeInvalidParams && { invalid_params: invalidParams }),
      ...(isDevelopment && {
        debug: {
          constraint: constraintName,
          fields: targetError.fields,
          message: targetError.message,
        },
      }),
    };

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(status).json(problemDetails);
  }

  /**
   * Attempts to translate a message using the i18n service with a fallback template.
   * If the key is missing, translation fails, or the result equals the key,
   * the fallback template is formatted with the provided arguments and used.
   *
   * @param key - The i18n translation key (may be null/undefined).
   * @param lang - The language code (e.g., 'en', 'ru').
   * @param args - Arguments to interpolate into the translation or fallback.
   * @param fallback - The fallback template string (uses `{placeholder}` syntax).
   * @returns The final message (translated or fallback).
   */
  private async translateWithFallback(
    key: string | undefined | null,
    lang: string,
    args: Record<string, unknown>,
    fallback: string,
  ): Promise<string> {
    if (!key) {
      this.logger.error(
        `Missing i18n key. Using fallback: ${fallback}. Args: ${JSON.stringify(args)}`,
      );
      return this.formatFallback(fallback, args);
    }

    try {
      const translated = await this.i18n.translate(key, { lang, args });
      if (typeof translated !== 'string' || translated === key) {
        this.logger.error(
          `Translation not found for key "${key}" (lang: ${lang}). Using fallback.`,
        );
        return this.formatFallback(fallback, args);
      }
      return translated;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Translation failed for key "${key}" (lang: ${lang}). Reason: ${errorMsg}. Using fallback.`,
      );
      return this.formatFallback(fallback, args);
    }
  }

  /**
   * Replaces placeholders in the template with corresponding values from `args`.
   * Placeholders are in the form `{name}`.
   *
   * @param template - The template string.
   * @param args - The argument object.
   * @returns The formatted string.
   */
  private formatFallback(
    template: string,
    args: Record<string, unknown>,
  ): string {
    return template.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value: unknown = args[name];
      if (value == null) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value as string | number | boolean | symbol | bigint);
    });
  }
}
