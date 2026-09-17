import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ProblemDetails } from '../interfaces/exception.interface.js';
import { ExceptionUtilsService } from '../exceptionFilters/exception-utils.service.js';

// Расширенный тип для ошибок, обрабатываемых фильтром
interface AppError extends Error {
  code?: number; // gRPC код (14 = UNAVAILABLE)
  details?: string; // детали ошибки
  path?: string; // gRPC-метод
}

@Injectable()
@Catch() // Ловим все ошибки, но обрабатываем только целевые
export class YdbExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Logger,
    private readonly exceptionUtils: ExceptionUtilsService,
  ) {}

  catch(exception: AppError, host: ArgumentsHost): void {
    // Проверка на недоступность YDB
    const isYdbUnavailable =
      exception.code === 14 ||
      (exception.details && exception.details.includes('Connection dropped'));

    // Проверка на AbortError (операция прервана)
    const isAbortError =
      exception.name === 'AbortError' &&
      exception.message?.toLowerCase().includes('aborted');

    // Если ошибка не относится к обрабатываемым – пробрасываем дальше
    if (!isYdbUnavailable && !isAbortError) {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const baseUrl = this.exceptionUtils.buildBaseUrl(request);

    this.logger.error(`Service error: ${exception.message}`, exception.stack);

    // Формируем Problem Details (RFC 7807)
    const problemDetails: ProblemDetails = {
      type: `${baseUrl}/errors/service-unavailable`,
      title: 'Service Unavailable',
      status: 503,
      instance: request.url,
      detail: 'The service is temporarily unavailable. Please try again later.',
    };

    response
      .setHeader('Content-Type', 'application/problem+json')
      .setHeader('Retry-After', '5')
      .status(503)
      .json(problemDetails);
  }
}
