// src/assignments/entities/types/assignment.types.ts

import type { MatchWithDetails } from '../../../matches/entities/types/match.types.js';

/**
 * Внутреннее представление назначения (доменная сущность).
 * Используется в репозитории и сервисе.
 *
 * Назначение — связка «судья X на матч Y в роли Z».
 * Три обязательные ссылки:
 *   - `matchId`     → matches.id
 *   - `userId`      → users.id (судья)
 *   - `fieldRoleId` → field_roles.id (роль на поле)
 *
 * На один матч может быть несколько назначений — по одному
 * на каждую роль в бригаде (Главный судья, Помощник, VAR, ...).
 *
 * Один судья не может быть назначен на один матч дважды
 * (проверка в репозитории).
 *
 * Один судья не может судить два матча в один день
 * (проверка в репозитории, требует JOIN с matches по дате).
 */
export interface Assignment {
  id: string;
  matchId: string;
  userId: string;
  fieldRoleId: string;
}

/**
 * Данные для создания назначения.
 *
 * Отличается от `Assignment`:
 *   - нет `id` — его генерирует репозиторий (uuidv4).
 *
 * Все поля обязательные: без матча, судьи или роли назначение
 * бессмысленно. Никаких nullable-полей нет.
 *
 * На create-пути репозиторий проверяет в одной транзакции:
 *   1. Матч существует.
 *   2. Судья существует.
 *   3. Роль существует.
 *   4. Судья не назначен на этот матч дважды.
 *   5. Судья не назначен на другой матч в тот же день.
 */
export interface CreateAssignmentData {
  matchId: string;
  userId: string;
  fieldRoleId: string;
}

/**
 * Данные для частичного обновления назначения.
 *
 * Все поля кроме `id` — опциональны.
 *
 * `matchId` НЕ входит в патч: перенос назначения на другой матч —
 * это delete + create. Семантически «назначение» привязано к матчу,
 * и смена матча — это создание нового назначения.
 *
 * Семантика `undefined` vs значение:
 *   - `undefined` — поле не передано, не трогаем в БД.
 *   - значение — заменить.
 *
 * `null` не допускается: у назначения нет nullable-полей.
 *
 * При смене `userId` репозиторий повторно проверяет:
 *   - новый судья существует;
 *   - он не назначен на этот матч дважды (исключая текущее назначение);
 *   - он не назначен на другой матч в тот же день (исключая текущий матч).
 *
 * При смене `fieldRoleId` — проверяет, что новая роль существует.
 */
export type UpdateAssignmentData = {
  id: string;
} & Partial<Omit<Assignment, 'id' | 'matchId'>>;

/**
 * Фильтры для поиска назначений.
 * Все поля опциональны — комбинируются через AND.
 *
 * `dateFrom` / `dateTo` фильтруют по дате матча — требуют JOIN
 * с matches. Используются для отчётов «назначения судьи за период».
 */
export interface AssignmentFilters {
  matchId?: string;
  userId?: string;
  fieldRoleId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Назначение с деталями: ФИО судьи и данные роли.
 * Возвращается из JOIN-запросов для отображения бригады.
 *
 * Используется в `MatchCrewController: GET /matches/:id/crew`
 * и в `AssignmentService.findAllByMatchWithDetails`.
 */
export interface AssignmentWithDetails extends Assignment {
  userFirstName: string;
  userLastName: string;
  roleCode: string;
  roleName: string;
  roleSortOrder: number;
}

/**
 * Данные «матч + бригада» для MatchCrewController.
 * Склейка {@link MatchWithDetails} и {@link AssignmentWithDetails}.
 *
 * `MatchWithDetails` импортируется как тип из модуля matches.
 * Это не создаёт runtime-зависимости: DI-модули по-прежнему
 * изолированы, `AssignmentModule` не импортирует `MatchModule`.
 *
 * Возвращается из `AssignmentService.getMatchCrew`.
 */
export interface MatchCrewData {
  match: MatchWithDetails;
  crew: AssignmentWithDetails[];
}

// ---------------------------------------------------------------------------
// Вспомогательные функции
// ---------------------------------------------------------------------------

/**
 * true, если назначение относится к указанной роли.
 *
 * Используется в бизнес-логике, например «есть ли в бригаде
 * главный судья (REFEREE)». Опирается на `fieldRoleId` —
 * конкретный UUID роли, переданный извне.
 *
 * Принимает идентификатор роли напрямую, чтобы не зависеть
 * от FieldRoleService в domain-слое.
 */
export function isRole(
  assignment: Pick<Assignment, 'fieldRoleId'>,
  roleId: string,
): boolean {
  return assignment.fieldRoleId === roleId;
}
