import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ParsedQs } from 'qs';
import { ParamsDictionary } from 'express-serve-static-core';
import {
  InvalidParam,
  Source,
  ValidationErrorItem,
} from '../interfaces/exception.interface.js';

@Injectable()
export class ExceptionUtilsService {
  constructor(private readonly logger: Logger) {}

  snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    );
  }

  camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  isPathParam(field: string, params: ParamsDictionary): boolean {
    const camel = this.snakeToCamel(field);
    return field in params || camel in params;
  }

  isQueryParam(field: string, query: ParsedQs): boolean {
    const camel = this.snakeToCamel(field);
    return field in query || camel in query;
  }

  determineSource(fieldDbName: string, request: Request): Source {
    const camelField = this.snakeToCamel(fieldDbName);
    const inParams = this.isPathParam(fieldDbName, request.params);
    const inQuery = this.isQueryParam(fieldDbName, request.query);
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(request.method);
    const inBody =
      hasBody &&
      request.body != null &&
      (fieldDbName in request.body || camelField in request.body);

    const sourcesCount = [inParams, inQuery, inBody].filter(Boolean).length;
    if (sourcesCount > 1) {
      const sources = [];
      if (inParams) sources.push('params');
      if (inQuery) sources.push('query');
      if (inBody) sources.push('body');
      this.logger.error(
        `Ambiguous source for field "${fieldDbName}": found in ${sources.join(', ')}. ` +
          `This may lead to incorrect error pointer.`,
      );
    }

    if (inParams) return { parameter: camelField };
    if (inQuery) return { query: camelField };
    if (inBody) return { pointer: `/${camelField}` };

    this.logger.error(
      `Field "${fieldDbName}" not found in path, query, or request body. Returning 'unknown' source.`,
    );
    return 'unknown';
  }

  buildBaseUrl(request: Request): string {
    return `${request.protocol}://${request.get('host')}`;
  }

  addErrorToGroup(
    groupedErrors: Record<
      string,
      { name: string; errors: ValidationErrorItem[] }
    >,
    fieldName: string,
    errorItem: ValidationErrorItem,
  ): void {
    if (!groupedErrors[fieldName]) {
      groupedErrors[fieldName] = { name: fieldName, errors: [] };
    }
    groupedErrors[fieldName].errors.push(errorItem);
  }

  groupedErrorsToInvalidParams(
    groupedErrors: Record<
      string,
      { name: string; errors: ValidationErrorItem[] }
    >,
  ): InvalidParam[] {
    return Object.values(groupedErrors);
  }
}
