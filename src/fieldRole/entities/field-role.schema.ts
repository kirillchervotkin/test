// src/field-roles/entities/field-role.schema.ts

import {
  ydbTable,
  uuid,
  text,
  uint32,
  uniqueIndex,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const fieldRoles = ydbTable(
  'field_roles',
  {
    // Первичный ключ — одиночный UUID.
    // При сиде задаются фиксированные UUID, чтобы можно было
    // ссылаться на них из других сид-данных и тестов.
    id: uuid('id').primaryKey().notNull(),

    // Программный код роли: 'REFEREE', 'ASSISTANT', 'RESERVE',
    // 'VAR', 'AVAR'. Уникален. Используется в бизнес-логике
    // (например, «на матч должен быть назначен REFEREE»)
    // и как ключ для локализации на фронте.
    code: text('code').notNull(),

    // Отображаемое имя на русском. Fallback для UI,
    // если фронт не знает код.
    name: text('name').notNull(),

    // Порядок отображения в UI: 1 — Главный судья, 2 — Помощник,
    // 3 — Резервный, 4 — VAR, 5 — AVAR. Используется в ORDER BY
    // при выборке ролей и в JOIN с назначениями.
    sortOrder: uint32('sort_order').notNull(),
  },
  (table) => [
    // Уникальный индекс на code: 'REFEREE' не может быть дважды.
    // Гарантия, что бизнес-логика, завязанная на код, не сломается.
    uniqueIndex('idx_field_roles_code').on(table.code),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
