import { Injectable, Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { query } from '@ydbjs/query';
import { YDBError } from '@ydbjs/error';
import { YDB_SQL } from '../common/ydb/ydb.constants.js';
import { YdbTypeMapper } from '../common/ydb/ydb-type.mapper.js';
import { YdbRowMapper } from '../common/ydb/ydb-row.mapper.js';
import { CreateUserListData, User, UserList } from './user-list.types.js';
import { DbUniqueViolationException } from '../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../common/exceptions/db-foreign-key-violation.exception.js';

/**
 * Repository for managing user-list relations in YDB.
 *
 * Handles CRUD operations on the `users_lists` join table,
 * including atomic assignment with foreign key and uniqueness checks.
 */
@Injectable()
export class UserListYdbRepository {
  /**
   * @param sql - YDB SQL query builder injected via the {@link YDB_SQL} token.
   * @param typeMapper - Mapper to convert JavaScript values to YDB types (e.g., UUID).
   * @param rowMapper - Mapper to extract typed entities from raw YDB result sets.
   */
  constructor(
    @Inject(YDB_SQL) private readonly sql: ReturnType<typeof query>,
    private readonly typeMapper: YdbTypeMapper,
    private readonly rowMapper: YdbRowMapper,
  ) {}

  /**
   * Atomically assigns a list to a user.
   *
   * Performs the following steps inside a serializable transaction:
   * 1. Verifies that the user exists.
   * 2. Verifies that the list exists.
   * 3. Inserts the relation; if a duplicate is detected (unique constraint violation),
   *    catches the database error and throws {@link DbUniqueViolationException}.
   *
   * @throws {DbForeignKeyViolationException} if either the user or the list does not exist.
   * @throws {DbUniqueViolationException} if the relation already exists (caught from DB).
   * @param data - The user and list identifiers.
   * @returns The newly created user-list relation.
   */
  async assignListToUserAtomic(data: CreateUserListData): Promise<UserList> {
    const { userId, listId } = data;
    const missingFields: { dbField: string; value?: unknown }[] = [];

    return this.sql.begin(
      {
        isolation: 'serializableReadWrite',
        idempotent: true,
      },
      async (tx) => {
        // 1. Check user existence
        const userRows = await tx`
          SELECT 1 FROM users WHERE id = ${this.typeMapper.toUuid(userId)}
        `;
        if (!userRows || userRows.length === 0 || userRows[0].length === 0) {
          missingFields.push({ dbField: 'user_id', value: userId });
        }

        // 2. Check list existence
        const listRows = await tx`
          SELECT 1 FROM lists WHERE id = ${this.typeMapper.toUuid(listId)}
        `;
        if (!listRows || listRows.length === 0 || listRows[0].length === 0) {
          missingFields.push({ dbField: 'list_id', value: listId });
        }

        if (missingFields.length > 0) {
          throw new DbForeignKeyViolationException(
            missingFields,
            'fk_users_lists',
          );
        }

        // 3. Insert the relation; rely on DB unique constraint for duplicate detection
        const id = uuidv4();
        try {
          await tx`
            INSERT INTO users_lists (id, user_id, list_id)
            VALUES (
              ${this.typeMapper.toUuid(id)},
              ${this.typeMapper.toUuid(userId)},
              ${this.typeMapper.toUuid(listId)}
            )
          `;
        } catch (error) {
          if (this.isDuplicateError(error)) {
            throw new DbUniqueViolationException(
              [
                { dbField: 'user_id', value: userId },
                { dbField: 'list_id', value: listId },
              ],
              'uq_users_lists_user_list',
            );
          }
          // Re-throw unexpected errors to be handled by upper layers
          throw error;
        }

        // 4. Retrieve the created record
        const inserted = await tx`
          SELECT id, user_id, list_id
          FROM users_lists
          WHERE id = ${this.typeMapper.toUuid(id)}
        `;

        const userList = this.rowMapper.extractOne(inserted, UserList);
        if (!userList) {
          throw new Error('Failed to fetch the created relation');
        }
        return userList;
      },
    );
  }

  /**
   * Finds a user-list relation by its unique identifier.
   *
   * @param id - The relation ID.
   * @returns The matching {@link UserList} or `null` if not found.
   */
  async findById(id: string): Promise<UserList | null> {
    return this.rowMapper.extractOne(
      await this.sql`
        SELECT id, user_id, list_id
        FROM users_lists
        WHERE id = ${this.typeMapper.toUuid(id)}
      `,
      UserList,
    );
  }

  /**
   * Finds a relation for a specific user and list combination.
   *
   * @param userId - The user ID.
   * @param listId - The list ID.
   * @returns The matching {@link UserList} or `null` if the relation does not exist.
   */
  async findByUserAndList(
    userId: string,
    listId: string,
  ): Promise<UserList | null> {
    return this.rowMapper.extractOne(
      await this.sql`
        SELECT id, user_id, list_id
        FROM users_lists
        WHERE user_id = ${this.typeMapper.toUuid(userId)}
          AND list_id = ${this.typeMapper.toUuid(listId)}
      `,
      UserList,
    );
  }

  /**
   * Retrieves all relations for a given user.
   *
   * @param userId - The user ID.
   * @returns An array of {@link UserList} objects (empty array if none exist).
   */
  async findAllByUser(userId: string): Promise<UserList[]> {
    return this.rowMapper.extractMany(
      await this.sql`
        SELECT id, user_id, list_id
        FROM users_lists
        WHERE user_id = ${this.typeMapper.toUuid(userId)}
      `,
      UserList,
    );
  }

  /**
   * Retrieves all relations for a given list.
   *
   * @param listId - The list ID.
   * @returns An array of {@link UserList} objects.
   */
  async findAllByList(listId: string): Promise<UserList[]> {
    return this.rowMapper.extractMany(
      await this.sql`
        SELECT id, user_id, list_id
        FROM users_lists
        WHERE list_id = ${this.typeMapper.toUuid(listId)}
      `,
      UserList,
    );
  }

  /**
   * Retrieves all user-list relations.
   *
   * @returns An array of all {@link UserList} records.
   */
  async findAll(): Promise<UserList[]> {
    return this.rowMapper.extractMany(
      await this.sql`
        SELECT id, user_id, list_id
        FROM users_lists
      `,
      UserList,
    );
  }

  /**
   * Deletes a relation by its ID.
   *
   * @param id - The relation ID.
   */
  async remove(id: string): Promise<void> {
    await this.sql`
      DELETE FROM users_lists
      WHERE id = ${this.typeMapper.toUuid(id)}
    `;
  }

  /**
   * Deletes a relation for a specific user and list.
   *
   * Uses `RETURNING` to return the removed record.
   *
   * @param userId - The user ID.
   * @param listId - The list ID.
   * @returns The deleted {@link UserList} object, or `null` if no matching relation existed.
   */
  async removeByUserAndList(
    userId: string,
    listId: string,
  ): Promise<UserList | null> {
    const result = await this.sql`
      DELETE FROM users_lists
      WHERE user_id = ${this.typeMapper.toUuid(userId)}
        AND list_id = ${this.typeMapper.toUuid(listId)}
      RETURNING id, user_id, list_id
    `;
    return this.rowMapper.extractOne(result, UserList);
  }

  async findUsersByList(listId: string): Promise<User[]> {
    return this.rowMapper.extractMany(
      await this.sql`
      SELECT u.*
      FROM users_lists ul
      INNER JOIN users u ON ul.user_id = u.id
      WHERE ul.list_id = ${this.typeMapper.toUuid(listId)}
    `,
      User, // <-- Так будет корректно и согласовано с остальной частью кода
    );
  }

  /**
   * Checks if the given error represents a duplicate key (unique constraint violation)
   * from YDB.
   *
   * @param error - The error object thrown by the driver.
   * @returns `true` if the error corresponds to YDB's "duplicate key" condition.
   */
  private isDuplicateError(error: unknown): boolean {
    return error instanceof YDBError && (error.code as number) === 400120;
  }
}
