// src/assignments/entities/assignment.schema.ts

import {
  ydbTable,
  uuid,
  index,
  tableOptions,
} from '@ydbjs/drizzle-adapter/schema';

export const assignments = ydbTable(
  'assignments',
  {
    // Первичный ключ — одиночный UUID.
    // Генерируется на бэкенде через uuidv4().
    id: uuid('id').primaryKey().notNull(),

    // Матч, на который назначен судья. Обязательное поле.
    // При удалении матча назначения должны удаляться каскадно
    // (проверка — в сервисном слое, YDB не enforced FK).
    matchId: uuid('match_id').notNull(),

    // Судья (пользователь). Обязательное поле.
    // Ссылается на users.id.
    userId: uuid('user_id').notNull(),

    // Роль на поле ('REFEREE', 'ASSISTANT', 'RESERVE', 'VAR', 'AVAR').
    // Обязательное поле. Ссылается на field_roles.id.
    fieldRoleId: uuid('field_role_id').notNull(),
  },
  (table) => [
    // Все назначения матча: GET /matches/:id/assignments.
    index('idx_assignments_match').on(table.matchId),

    // Все назначения судьи: GET /assignments?userId=X.
    // Также используется в проверке «судья не судит два матча
    // в один день» — сначала выбираем назначения судьи, потом
    // JOIN с matches по дате.
    index('idx_assignments_user').on(table.userId),

    // Отчёты по ролям: «все VAR», «все главные судьи».
    index('idx_assignments_role').on(table.fieldRoleId),

    tableOptions({
      AUTO_PARTITIONING_BY_SIZE: 'ENABLED',
      AUTO_PARTITIONING_PARTITION_SIZE_MB: 2048,
    }),
  ],
);
