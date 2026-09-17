/**
 * Внутреннее представление пользователя (доменная сущность).
 * Используется в репозитории и сервисе.
 * Не содержит декораторов валидации/сериализации.
 *
 * Поля, которые могут быть NULL в БД, помечены как `| null`.
 */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null; // NULL в БД → null
  birthDate: Date | null; // NULL в БД → null
  passwordHash: string | null; // NULL в БД → null (например, для OAuth)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Данные для создания пользователя (передаются в репозиторий).
 * Все необязательные поля – `?:` (без null).
 * При отсутствии поля оно не попадает в INSERT → БД ставит NULL (если допускает).
 */
export type CreateUserData = {
  firstName: string; // обязательно
  lastName: string; // обязательно
  email?: string; // опционально → NULL в БД
  passwordHash?: string; // опционально → NULL в БД
  birthDate?: Date; // опционально → NULL в БД
  isActive?: boolean; // опционально → по умолчанию false (задаётся в коде)
};

/**
 * Данные для обновления пользователя (передаются в репозиторий).
 * Все поля опциональны (кроме id) и могут быть null для явного сброса.
 * null преобразуется в sql`NULL` через prepareUpdateData.
 */
export type UpdateUserData = {
  id: string;
} & Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;
// и все остальные поля из User (кроме id, createdAt, updatedAt) становятся опциональными и nullable.
