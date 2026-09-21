// src/assignments/assignment.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Assignment,
  CreateAssignmentData,
  UpdateAssignmentData,
  AssignmentFilters,
  AssignmentWithDetails,
  MatchCrewData,
} from './entities/types/assignment.types.js';
import { AssignmentRepository } from './repository/assignment.repository.js';

/**
 * Сервис управления назначениями.
 *
 * Тонкая обёртка над {@link AssignmentRepository}. Вся работа с БД
 * инкапсулирована в репозитории:
 *   - транзакции с `idempotent: true`;
 *   - три FK-проверки (матч, судья, роль);
 *   - две бизнес-проверки (дубликат на матче, «два матча в день»);
 *   - обработка unique-violation.
 *
 * Сервис не инжектит `DRIZZLE`, не зависит от других сервисов,
 * не открывает транзакции. Он добавляет только бизнес-семантику:
 *   - перевод `null` в {@link NotFoundException};
 *   - склейка «матч + бригада» для MatchCrewController.
 *
 * Регламентные проверки вроде «на матч должен быть назначен
 * REFEREE» НЕ реализуются: бригада может быть неполной, это
 * нормальное состояние.
 */
@Injectable()
export class AssignmentService {
  constructor(private readonly repository: AssignmentRepository) {}

  // ============================================================
  // CREATE
  //
  // Репозиторий в одной транзакции:
  //   1. Читает матч → получает matchDate.
  //   2. Проверяет судью.
  //   3. Проверяет роль.
  //   4. Проверяет, что судья не назначен на матч дважды.
  //   5. Проверяет, что судья не назначен на другой матч
  //      в тот же день.
  //   6. Делает INSERT.
  //
  // Сервис просто делегирует.
  // ============================================================
  async create(data: CreateAssignmentData): Promise<Assignment> {
    return this.repository.create(data);
  }

  // ============================================================
  // FIND BY ID
  //
  // Возвращает `null`, если назначения нет. Контроллер сам решает,
  // что с этим делать (обычно — NotFoundException).
  // ============================================================
  async findById(id: string): Promise<Assignment | null> {
    return this.repository.findById(id);
  }

  // ============================================================
  // FIND ALL BY MATCH
  //
  // Все назначения матча без деталей. Используется в CRUD-контексте
  // (редактор бригады), когда нужны только ID-ссылки.
  // ============================================================
  async findAllByMatch(matchId: string): Promise<Assignment[]> {
    return this.repository.findAllByMatch(matchId);
  }

  // ============================================================
  // FIND ALL BY MATCH WITH DETAILS
  //
  // Все назначения матча с ФИО судьи и данными роли.
  // Отсортированы по sortOrder роли (Главный судья первый).
  //
  // Используется в MatchCrewController через getMatchCrew.
  // Отдельный метод оставлен для случаев, когда нужна только
  // бригада без контекста матча.
  // ============================================================
  async findAllByMatchWithDetails(
    matchId: string,
  ): Promise<AssignmentWithDetails[]> {
    return this.repository.findAllByMatchWithDetails(matchId);
  }

  // ============================================================
  // FIND ALL BY USER
  //
  // Все назначения судьи (для отчётов «где судил Петров»).
  // ============================================================
  async findAllByUser(userId: string): Promise<Assignment[]> {
    return this.repository.findAllByUser(userId);
  }

  // ============================================================
  // FIND ALL (фильтры + сортировка, без пагинации)
  //
  // Назначения всегда смотрят с фильтром (по матчу, судье, роли
  // или дате). Без фильтра список бессмысленен — 2000 записей
  // за сезон никто не листает. Пагинация не нужна.
  //
  // Если заданы dateFrom / dateTo — репозиторий делает JOIN
  // с matches для фильтра по дате матча. Иначе — без JOIN.
  // ============================================================
  async findAll(params: {
    filter?: AssignmentFilters;
    orderDir?: 'ASC' | 'DESC';
  }): Promise<Assignment[]> {
    return this.repository.findAll(params.filter, params.orderDir ?? 'ASC');
  }

  // ============================================================
  // GET MATCH CREW
  //
  // Склеивает матч с деталями и бригаду с ФИО в один объект.
  // Используется в MatchCrewController: GET /matches/:id/crew.
  //
  // Возвращает `null`, если матч не существует.
  // Пустая бригада — валидное состояние: `{ match, crew: [] }`,
  // не `null`.
  //
  // Вся логика — в модуле назначений. Зависимости от MatchModule
  // нет: репозиторий читает схему matches напрямую.
  //
  // Два запроса к БД:
  //   1. findMatchWithDetails — матч + команды + город + этап.
  //   2. findAllByMatchWithDetails — бригада с ФИО и ролями.
  //
  // Не используем один SQL с 7 JOIN'ами: это хрупко и медленно
  // в YDB. Два-три запроса + склейка в сервисе — правильный подход.
  // ============================================================
  async getMatchCrew(matchId: string): Promise<MatchCrewData | null> {
    const match = await this.repository.findMatchWithDetails(matchId);
    if (!match) return null;

    const crew = await this.repository.findAllByMatchWithDetails(matchId);

    return { match, crew };
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Бросает NotFoundException, если назначения нет.
  //
  // `matchId` не меняется: перенос назначения на другой матч —
  // это delete + create.
  //
  // При смене `userId` репозиторий повторно проверяет нового
  // судью (существует, нет дубликата на матче, нет другого
  // матча в тот же день).
  //
  // При смене `fieldRoleId` — проверяет, что новая роль
  // существует.
  //
  // Двойная проверка `null` (на findById и на updatePartial) —
  // как в CityService.update и TeamService.update: запись могли
  // удалить между двумя вызовами.
  // ============================================================
  async update(data: UpdateAssignmentData): Promise<Assignment> {
    const current = await this.repository.findById(data.id);
    if (!current) {
      throw new NotFoundException(`Assignment with id ${data.id} not found`);
    }

    const updated = await this.repository.updatePartial(data);
    if (!updated) {
      // Запись могли удалить между findById и updatePartial —
      // трактуем так же, как «не найдено».
      throw new NotFoundException(`Assignment with id ${data.id} not found`);
    }
    return updated;
  }

  // ============================================================
  // DELETE
  //
  // Репозиторий делает простое удаление. Если назначения нет —
  // возвращает null, и сервис бросает NotFoundException.
  //
  // Каскадов нет: назначение не является родителем для других
  // сущностей.
  // ============================================================
  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Assignment with id ${id} not found`);
    }
  }

  // ============================================================
  // DELETE ALL BY MATCH
  //
  // Каскад при удалении матча. Вызывается из MatchService
  // при каскадном удалении (если понадобится).
  //
  // В публичный HTTP API не выходит.
  // ============================================================
  async deleteAllByMatch(matchId: string): Promise<void> {
    await this.repository.deleteAllByMatch(matchId);
  }
}
