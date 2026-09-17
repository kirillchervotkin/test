import { Injectable, Inject } from '@nestjs/common';
import { YDB_SQL } from '../common/ydb/ydb.constants.js';
import { YdbTypeMapper } from '../common/ydb/ydb-type.mapper.js';
import { YdbRowMapper } from '../common/ydb/ydb-row.mapper.js';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@ydbjs/query';
import { YDBError } from '@ydbjs/error';
import { CreateListData, List } from './list.types.js';
import { DbUniqueViolationException } from '../common/exceptions/db-unique-violation.exception.js';

@Injectable()
export class ListYdbRepository {
  constructor(
    @Inject(YDB_SQL) private readonly sql: ReturnType<typeof query>,
    private readonly typeMapper: YdbTypeMapper,
    private readonly rowMapper: YdbRowMapper,
  ) {}

  async createList(data: CreateListData): Promise<List> {
    const id = uuidv4();
    const now = new Date();

    try {
      const result = await this.sql`
        INSERT INTO lists (id, name, created_at, updated_at)
        VALUES (${this.typeMapper.toUuid(id)}, ${data.name}, ${now}, ${now})
        RETURNING id, name, created_at, updated_at
      `;

      const list = this.rowMapper.extractOne(result, List);
      if (!list) {
        throw new Error('Failed to create list');
      }
      return list;
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'name', value: data.name },
        ]);
      }
      throw new Error('Failed to create a list due to an unexpected error');
    }
  }

  /**
   * Обновляет список по идентификатору.
   * Возвращает обновлённый список или null, если запись не найдена.
   * Выбрасывает DbUniqueViolationException при нарушении уникальности имени.
   */
  async update(entity: List): Promise<List | null> {
    const now = new Date();

    try {
      const result = await this.sql`
        UPDATE lists
        SET name = ${entity.name}, updated_at = ${now}
        WHERE id = ${this.typeMapper.toUuid(entity.id)}
        RETURNING id, name, created_at, updated_at
      `;

      return this.rowMapper.extractOne(result, List);
    } catch (error) {
      if (this.isDuplicateError(error)) {
        throw new DbUniqueViolationException([
          { dbField: 'name', value: entity.name },
        ]);
      }
      throw error;
    }
  }

  async findById(id: string): Promise<List | null> {
    return this.rowMapper.extractOne(
      await this.sql`
        SELECT id, name, created_at, updated_at
        FROM lists
        WHERE id = ${this.typeMapper.toUuid(id)}
      `,
      List,
    );
  }

  async findAll(): Promise<List[]> {
    return this.rowMapper.extractMany(
      await this.sql`
        SELECT id, name, created_at, updated_at FROM lists
      `,
      List,
    );
  }

  /**
   * Удаляет список и все связанные с ним записи в users_lists (каскадное удаление).
   * Операция выполняется в атомарной транзакции.
   * Возвращает удалённый список или null, если список не найден.
   */
  async remove(id: string): Promise<List | null> {
    return this.sql.begin(
      {
        isolation: 'serializableReadWrite',
        idempotent: true,
      },
      async (tx) => {
        // 1. Удаляем все связи, где list_id = id
        await tx`
          DELETE FROM users_lists
          WHERE list_id = ${this.typeMapper.toUuid(id)}
        `;

        // 2. Удаляем сам список и возвращаем удалённую строку
        const result = await tx`
          DELETE FROM lists
          WHERE id = ${this.typeMapper.toUuid(id)}
          RETURNING id, name, created_at, updated_at
        `;

        return this.rowMapper.extractOne(result, List);
      },
    );
  }

  private isDuplicateError(error: unknown): boolean {
    return error instanceof YDBError && (error.code as number) === 400120;
  }
}
