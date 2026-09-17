// src/user/entities/user.schema.ts
import {
  ydbTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  tableOptions,
  uniqueIndex,
} from '@ydbjs/drizzle-adapter/schema';
import { sql } from 'drizzle-orm';

// ============================================================
//  СХЕМА ТАБЛИЦЫ
// ============================================================
export const users = ydbTable(
  'users',
  {
    id: uuid('id').primaryKey().notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    birthDate: date('birth_date'),
    passwordHash: text('password_hash'),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at')
      .notNull()
      .default(sql`CurrentUtcDatetime()`),
    updatedAt: timestamp('updated_at')
      .notNull()
      .default(sql`CurrentUtcDatetime()`),
  },
  (table) => [
    uniqueIndex('idx_users_email').on(table.email),
    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);

// ============================================================
//  ТИПЫ ДЛЯ ПРИЛОЖЕНИЯ (на основе схемы)
// ============================================================

/** Полная структура пользователя (SELECT) */
export type User = typeof users.$inferSelect;

/** Данные для создания пользователя (INSERT) – поля, которые можно передать при вставке */
export type CreateUserData = Omit<
  typeof users.$inferInsert,
  'id' | 'createdAt' | 'updatedAt'
>;

/** Данные для обновления пользователя – id + любые изменяемые поля (кроме id, createdAt, updatedAt) */
export type UpdateUserData = {
  id: string;
} & Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

// Дополнительно можно экспортировать и сырые типы Drizzle (если понадобятся)
export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
