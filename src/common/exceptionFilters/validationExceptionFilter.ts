import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ValidationError } from 'class-validator';
import { I18nValidationException, I18nService, I18nContext } from 'nestjs-i18n';
import { formatI18nErrors } from 'nestjs-i18n/dist/utils/util.js';

import { ExceptionUtilsService } from './exception-utils.service.js';
import {
  FlatValidationError,
  InvalidParam,
  ProblemDetails,
  ValidationErrorItem,
} from '../interfaces/exception.interface.js';

interface I18nValidationExceptionWithContext extends I18nValidationException {
  i18nContext?: I18nContext;
}

@Injectable()
@Catch(I18nValidationException)
export class ValidationExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: Logger,
    private readonly exceptionUtils: ExceptionUtilsService,
    private readonly i18nService: I18nService,
  ) {}

  catch(exception: I18nValidationException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const ex = exception as I18nValidationExceptionWithContext;
    const i18nContext = ex.i18nContext;
    const lang = i18nContext?.lang;

    const baseUrl = this.exceptionUtils.buildBaseUrl(request);

    if (exception.errors && Array.isArray(exception.errors)) {
      const translatedErrors = formatI18nErrors(
        exception.errors,
        this.i18nService,
        { lang },
      );

      const flatErrors = this.flattenValidationErrors(translatedErrors);
      const groupedErrors: Record<
        string,
        { fieldName: string; errors: ValidationErrorItem[] }
      > = {};

      for (const flat of flatErrors) {
        const { property, error } = flat;
        const constraints = error.constraints ?? {};
        const fieldName = property.split('.').pop()!;
        const source = this.exceptionUtils.determineSource(fieldName, request);

        if (!groupedErrors[fieldName]) {
          groupedErrors[fieldName] = {
            fieldName,
            errors: [],
          };
        }

        for (const [constraintKey, constraintMessage] of Object.entries(
          constraints,
        )) {
          groupedErrors[fieldName].errors.push({
            reason: constraintMessage,
            code: constraintKey,
            source,
          });
        }
      }

      const invalidParams: InvalidParam[] = Object.values(groupedErrors).map(
        (group) => ({
          name: group.fieldName,
          errors: group.errors,
        }),
      );

      const problemDetails: ProblemDetails = {
        type: `${baseUrl}/errors/validation-error`,
        title: 'Unprocessable Entity',
        status: 422,
        instance: request.url,
        detail:
          'The request contains invalid data. See invalid_params for details.',
        invalid_params: invalidParams,
      };

      response.setHeader('Content-Type', 'application/problem+json');
      response.status(422).json(problemDetails);
      return;
    }

    let detail = 'The request could not be understood due to malformed syntax.';
    let errorType = `${baseUrl}/errors/bad-request`;

    const msg = exception.message.toLowerCase();
    if (msg.includes('unexpected end of json input')) {
      detail = 'Request body is empty or contains invalid JSON.';
      errorType = `${baseUrl}/errors/empty-json`;
    } else if (msg.includes('bad control character')) {
      detail = 'Malformed JSON in request body (control character).';
      errorType = `${baseUrl}/errors/malformed-json`;
    } else if (msg.includes('invalid character')) {
      detail = 'Malformed JSON in request body (invalid character).';
      errorType = `${baseUrl}/errors/malformed-json`;
    } else if (msg.includes('content-type')) {
      detail =
        'Missing or invalid Content-Type header. Expected application/json.';
      errorType = `${baseUrl}/errors/invalid-content-type`;
    } else if (msg.includes('too large') || msg.includes('limit')) {
      detail = 'Request body exceeds maximum allowed size.';
      errorType = `${baseUrl}/errors/payload-too-large`;
    } else if (
      msg.includes('unexpected token') ||
      msg.includes('is not valid json')
    ) {
      detail = 'Malformed JSON in request body (syntax error).';
      errorType = `${baseUrl}/errors/malformed-json`;
    } else {
      this.logger.error(
        `Unhandled BadRequestException message: "${exception.message}"`,
      );
      detail = 'The request could not be understood due to malformed syntax.';
      errorType = `${baseUrl}/errors/bad-request`;
    }

    const problemDetails: ProblemDetails = {
      type: errorType,
      title: 'Bad Request',
      status: 400,
      instance: request.url,
      detail,
      debug:
        process.env.NODE_ENV === 'development' ? exception.message : undefined,
    };

    response.setHeader('Content-Type', 'application/problem+json');
    response.status(400).json(problemDetails);
  }

  private flattenValidationErrors(
    errors: ValidationError[],
    parentPath = '',
  ): FlatValidationError[] {
    const result: FlatValidationError[] = [];

    for (const error of errors) {
      const propertyPath = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;

      if (error.constraints) {
        result.push({
          property: propertyPath,
          error,
          value: error.value,
        });
      }

      if (error.children && error.children.length > 0) {
        result.push(
          ...this.flattenValidationErrors(error.children, propertyPath),
        );
      }
    }

    return result;
  }
}
