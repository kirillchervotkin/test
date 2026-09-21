// src/common/exceptionFilters/ydbExceptionFilter.ts

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { YDBError } from '@ydbjs/error';
import { ProblemDetails } from '../interfaces/exception.interface.js';
import { ExceptionUtilsService } from '../exceptionFilters/exception-utils.service.js';

// ============================================================
//  Хелперы
// ============================================================

/**
 * Достаёт YDBError — напрямую или из `cause` (DrizzleQueryError).
 */
function extractYdbError(err: unknown): YDBError | null {
  if (err instanceof YDBError) return err;

  if (err instanceof Error && err.cause) {
    if (err.cause instanceof YDBError) return err.cause;

    const nested = err.cause as { cause?: unknown };
    if (nested?.cause instanceof YDBError) return nested.cause;
  }

  return null;
}

/**
 * Транспортная ошибка — YDB недоступен, соединение упало, запрос прерван.
 * Это не ошибка запроса, а проблема связи. Клиенту — 503 + Retry-After.
 */
function isTransportError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;

  const e = err as Record<string, unknown>;

  // gRPC UNAVAILABLE
  if (e.code === 14) return true;

  // "Connection dropped" в details
  if (
    typeof e.details === 'string' &&
    e.details.includes('Connection dropped')
  ) {
    return true;
  }

  // AbortError от AbortController
  if (e.name === 'AbortError') return true;

  return false;
}

/**
 * Самое глубокое сообщение из дерева issues YDB.
 * Это то, на что реально ругается YDB.
 */
function deepestIssueMessage(issues: unknown): string | null {
  if (!Array.isArray(issues) || issues.length === 0) return null;

  let last: string | null = null;

  for (const issue of issues) {
    if (typeof issue !== 'object' || issue === null) continue;

    const it = issue as Record<string, unknown>;
    const msg = typeof it.message === 'string' ? it.message : null;

    if (it.issues) {
      const nested = deepestIssueMessage(it.issues);
      if (nested) last = nested;
    } else if (msg) {
      last = msg;
    }
  }

  return last;
}

// ============================================================
//  Фильтр
// ============================================================

/**
 * Единый фильтр для ошибок YDB.
 *
 * Обрабатывает два случая:
 *
 *   1. Транспортная ошибка (YDB недоступен, соединение упало,
 *      запрос прерван). Клиенту — 503 Service Unavailable
 *      с заголовком Retry-After. Клиент может повторить запрос.
 *
 *   2. Логическая ошибка YDB (Type annotation, unique violation
 *      на уровне YDB, precondition failed и т.п.). В лог пишется
 *      одна строка с методом, URL и самой глубокой причиной.
 *      Клиенту — 500 Internal Server Error.
 *
 * Все остальные ошибки (NotFoundException, BadRequestException,
 * DbUniqueViolationException, ошибки валидации) пробрасываются
 * дальше — их обработают другие фильтры.
 *
 * ВАЖНО: регистрировать ПОСЛЕДНИМ в списке APP_FILTER в AppModule.
 * Тогда он применяется первым и может пробрасывать чужие ошибки
 * дальше по цепочке фильтров.
 */
@Injectable()
@Catch()
export class YdbExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Logger,
    private readonly exceptionUtils: ExceptionUtilsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // ---- 1. Транспортная ошибка → 503 --------------------------------
    if (isTransportError(exception)) {
      this.handleTransportError(exception as Error, host);
      return;
    }

    // ---- 2. Логическая ошибка YDB → 500 ------------------------------
    const ydbError = extractYdbError(exception);
    if (ydbError) {
      this.handleYdbError(ydbError, exception, host);
      return;
    }

    // ---- 3. Чужая ошибка → проброс дальше ---------------------------
    // Сработает, только если фильтр зарегистрирован последним
    // в списке APP_FILTER (то есть применяется первым).
    throw exception;
  }

  // ============================================================
  //  Обработчики
  // ============================================================

  private handleTransportError(error: Error, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(`YDB transport error: ${error.message}`);
      throw error;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const baseUrl = this.exceptionUtils.buildBaseUrl(request);

    this.logger.error(`YDB transport error: ${error.message}`, error.stack);

    const problemDetails: ProblemDetails = {
      type: `${baseUrl}/errors/service-unavailable`,
      title: 'Service Unavailable',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      instance: request.url,
      detail: 'The service is temporarily unavailable. Please try again later.',
    };

    if (response.headersSent) return;

    response
      .setHeader('Content-Type', 'application/problem+json')
      .setHeader('Retry-After', '5')
      .status(HttpStatus.SERVICE_UNAVAILABLE)
      .json(problemDetails);
  }

  private handleYdbError(
    ydbError: YDBError,
    originalException: unknown,
    host: ArgumentsHost,
  ): void {
    const code = (ydbError as unknown as { code?: number }).code;
    const issues = (ydbError as unknown as { issues?: unknown }).issues;
    const detail = deepestIssueMessage(issues) ?? ydbError.message;

    if (host.getType() !== 'http') {
      this.logger.error(`YDB error: ${detail}${code ? ` [code=${code}]` : ''}`);
      throw originalException;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const codeSuffix = code ? ` [code=${code}]` : '';
    this.logger.error(
      `${request.method} ${request.originalUrl}\n${detail}${codeSuffix}`,
    );

    if (response.headersSent) return;

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Внутренняя ошибка базы данных',
      code: code ?? null,
    });
  }
}
