import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { create } from '@bufbuild/protobuf';
import { IssueMessageSchema } from '@ydbjs/api/operation';
import { YDBError } from '@ydbjs/error';
import { translateUniqueError } from './ydb-constraint-errors.js';
import {
  Constraint,
  CONSTRAINT_FIELDS_KEY,
} from '../decorators/unique.decorator.js';
import { DbUniqueViolationException } from '../exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../exceptions/db-foreign-key-violation.exception.js';
import { DbConstraintExceptionFilter } from '../exceptionFilters/dbConstraintExceptionFilter.js';
import { ExceptionUtilsService } from '../exceptionFilters/exception-utils.service.js';
import { StoreDtoValidationPipe } from '../pipes/store-dto-validation.pipe.js';
import { mappingStorage } from '../middlwares/context.js';
import { UpdateTeamDto } from '../../team/dto/updateTeam.dto.js';

function fixture(method = 'POST') {
  let result: Record<string, unknown> = {};
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn((body) => {
      result = body;
    }),
  };
  response.status.mockReturnValue(response);
  const request = {
    method,
    headers: { 'accept-language': 'ru' },
    protocol: 'http',
    get: () => 'localhost',
    url: '/teams',
    body: { name: 'Команда', cityId: 'id' },
    params: {},
    query: {},
  };
  const logger = new Logger();
  const filter = new DbConstraintExceptionFilter(
    logger,
    {} as never,
    new ExceptionUtilsService(logger),
    {
      translate: async (key: string) =>
        key === 'validation.CITY_NOT_FOUND' ? 'Город не найден' : 'Дубликат',
    } as never,
  );
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  };
  return { filter, host, response, result: () => result };
}
describe('Кастомные ограничения', () => {
  it.each([
    [
      new DbUniqueViolationException([{ dbField: 'name' }]),
      'POST',
      409,
      'UNIQUE_VIOLATION',
    ],
    [
      new DbUniqueViolationException(
        [{ dbField: 'name' }, { dbField: 'cityId' }],
        'uq_teams_city_name',
      ),
      'PUT',
      409,
      'COMPOSITE_UNIQUE_VIOLATION',
    ],
    [
      new DbForeignKeyViolationException([{ dbField: 'cityId' }]),
      'POST',
      422,
      'REFERENCE_NOT_FOUND',
    ],
    [
      new DbForeignKeyViolationException([{ dbField: 'id' }]),
      'DELETE',
      409,
      null,
    ],
  ] as const)('обрабатывает %s (%s)', async (error, method, status, code) => {
    const f = fixture(method);
    await mappingStorage.run(
      {
        columnMapping: {},
        validationMessages: {
          cityId: { foreignKey: 'validation.CITY_NOT_FOUND' },
        },
      },
      async () => {
        await f.filter.catch(
          new Error('outer', {
            cause: new Error('Transaction failed.', { cause: error }),
          }),
          f.host as never,
        );
      },
    );
    expect(f.response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/problem+json',
    );
    expect(f.result().status).toBe(status);
    if (code)
      expect(f.result().invalid_params).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            errors: expect.arrayContaining([expect.objectContaining({ code })]),
          }),
        ]),
      );
    else expect(f.result().invalid_params).toBeUndefined();
  });
  it('сохраняет метаданные ограничений UpdateTeamDto', async () => {
    await mappingStorage.run(
      { columnMapping: {}, validationMessages: {} },
      async () => {
        await new StoreDtoValidationPipe().transform(
          { name: 'Команда' },
          { type: 'body', metatype: UpdateTeamDto },
        );
        expect(
          mappingStorage.getStore()?.validationMessages.cityId.foreignKey,
        ).toBe('validation.CITY_NOT_FOUND');
        expect(
          mappingStorage.getStore()?.validationMessages.name.uniqueComposite,
        ).toBe('validation.UNIQUE_TEAM_CITY');
      },
    );
  });
  it('декоратор подкласса не изменяет список полей родителя', () => {
    class Parent {
      name!: string;
    }
    class Child extends Parent {
      cityId!: string;
    }
    Constraint()(Parent.prototype, 'name');
    Constraint()(Child.prototype, 'cityId');
    expect(
      Reflect.getMetadata(CONSTRAINT_FIELDS_KEY, Parent.prototype),
    ).toEqual(['name']);
    expect(Reflect.getMetadata(CONSTRAINT_FIELDS_KEY, Child.prototype)).toEqual(
      ['name', 'cityId'],
    );
  });
  it('транслирует вложенную ошибку YDB об уникальности', async () => {
    const error = new YDBError(400120, [
      create(IssueMessageSchema, {
        message: 'Constraint violated. Table: cities',
        severity: 1,
        issueCode: 2012,
        issues: [],
      }),
    ]);
    await expect(
      translateUniqueError(
        new Error('wrapper', { cause: error }),
        [{ dbField: 'id', value: 'x' }],
        'pk_cities',
      ),
    ).rejects.toBeInstanceOf(DbUniqueViolationException);
  });
  it('не маскирует другие PRECONDITION_FAILED', async () => {
    const error = new YDBError(400120, [
      create(IssueMessageSchema, { message: 'Table is not ready', severity: 1, issueCode: 1, issues: [] }),
    ]);
    await expect(translateUniqueError(error, [], 'x')).rejects.toBe(error);
  });
});
