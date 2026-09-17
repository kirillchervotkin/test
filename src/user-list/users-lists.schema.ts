// src/list/entities/users-lists.schema.ts
import {
  ydbTable,
  uuid,
  uniqueIndex,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const usersLists = ydbTable(
  'users_lists',
  {
    id: uuid('id').primaryKey().notNull(),
    userId: uuid('user_id').notNull(),
    listId: uuid('list_id').notNull(),
  },
  (table) => [
    uniqueIndex('uniq_user_list').on(table.userId, table.listId),
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);

export type UsersList = typeof usersLists.$inferSelect;
export type CreateUsersList = typeof usersLists.$inferInsert;
