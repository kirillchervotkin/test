import { ValidationError } from 'class-validator';

export interface PostgresDriverError {
  code?: string;
  detail?: string;
  message?: string;
  constraint?: string;
  table?: string;
}

export type Source =
  | { parameter: string }
  | { pointer: string }
  | { query: string }
  | 'unknown';

export interface ValidationErrorItem {
  reason: string;
  code: string;
  source?: Source;
  compositeGroup?: string;
}

export interface InvalidParam {
  name: string;
  errors: ValidationErrorItem[];
}

export interface PostgresDebugInfo {
  driverMessage: string;
  code: string;
  constraint?: string;
  table?: string;
  detail?: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  instance: string;
  invalid_params?: InvalidParam[];
  detail: string;
  debug?: unknown;
}

export type Criteria = Record<string, unknown>;

export interface FlatValidationError {
  property: string;
  error: ValidationError;
  value?: unknown;
}

export interface BadRequestExceptionResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  errors?: ValidationError[];
}

export type SafeEntityTarget =
  | string
  | (new (...args: never[]) => unknown)
  | { name: string };
