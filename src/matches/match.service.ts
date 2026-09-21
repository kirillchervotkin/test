// src/matches/match.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Match,
  CreateMatchInput,
  UpdateMatchData,
  MatchFilters,
} from './entities/types/match.types.js';
import { MatchRepository } from './repository/match.repository.js';

/**
 * Сервис управления матчами.
 *
 * Тонкая обёртка над {@link MatchRepository}. Вся работа с БД
 * инкапсулирована в репозитории:
 *   - транзакции с `idempotent: true` (автоматический retry);
 *   - чтение stage для вывода `tournamentId` и проверки
 *     `tourNumber ↔ format` — в одной транзакции с INSERT;
 *   - FK-проверки города и команд;
 *   - обработка unique-violation.
 *
 * Сервис не инжектит `DRIZZLE`, не зависит от `StageService`,
 * не открывает транзакции. Это осознанное решение: репозиторий
 * работает со схемами напрямую (через Drizzle), и межать
 * модулями не нужно.
 *
 * Сервис добавляет только бизнес-семантику:
 *   - перевод `null` в {@link NotFoundException};
 *   - проверка «команды не совпадают» после слияния патча
 *     с текущим состоянием (DTO видит только патч, репозиторий —
 *     только поля к обновлению; итоговое состояние знает сервис).
 */
@Injectable()
export class MatchService {
  constructor(private readonly repository: MatchRepository) {}

  // ============================================================
  // CREATE
  //
  // Репозиторий сам:
  //   1. Читает stage → получает tournamentId и format.
  //   2. Проверяет, что турнир существует.
  //   3. Проверяет tourNumber ↔ format.
  //   4. Проверяет город.
  //   5. Проверяет команды (если заданы).
  //   6. Делает INSERT с выведенным tournamentId.
  //
  // Всё в одной транзакции. Сервис просто делегирует.
  // ============================================================
  async create(input: CreateMatchInput): Promise<Match> {
    return this.repository.create(input);
  }

  // ============================================================
  // FIND BY ID
  //
  // Возвращает `null`, если матча нет. Контроллер сам решает,
  // что с этим делать (обычно — NotFoundException).
  // ============================================================
  async findById(id: string): Promise<Match | null> {
    return this.repository.findById(id);
  }

  // ============================================================
  // FIND ALL BY STAGE
  // Все матчи этапа (группы или раунда), отсортированы по дате.
  // ============================================================
  async findAllByStage(stageId: string): Promise<Match[]> {
    return this.repository.findAllByStage(stageId);
  }

  // ============================================================
  // FIND ALL BY TOURNAMENT
  // Все матчи турнира, отсортированы по дате.
  // ============================================================
  async findAllByTournament(tournamentId: string): Promise<Match[]> {
    return this.repository.findAllByTournament(tournamentId);
  }

  // ============================================================
  // FIND ALL BY TEAM
  // Все матчи команды (home OR away), отсортированы по дате.
  // ============================================================
  async findAllByTeam(teamId: string): Promise<Match[]> {
    return this.repository.findAllByTeam(teamId);
  }

  // ============================================================
  // FIND ALL (фильтры, пагинация, сортировка)
  //
  // Пагинация нужна: матчей сотни и тысячи.
  // Возвращает { rows, total }.
  // ============================================================
  async findAll(params: {
    filter?: MatchFilters;
    limit?: number;
    offset?: number;
    orderBy?: 'matchDate' | 'tourNumber';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<{ rows: Match[]; total: number }> {
    return this.repository.findAll(
      params.filter,
      params.limit ?? 100,
      params.offset ?? 0,
      params.orderBy ?? 'matchDate',
      params.orderDir ?? 'ASC',
    );
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Единственная проверка, которую репозиторий не делает сам:
  // «команды не совпадают» после слияния патча с текущим
  // состоянием.
  //
  // Проблема: клиент присылает патч, в котором может быть только
  // одна из команд. Например, текущий матч — «Зенит vs ЦСКА».
  // Клиент присылает PATCH { awayTeamId: 'Зенит' }. DTO видит
  // только патч, репозиторий видит только field to update.
  // Итоговое состояние — «Зенит vs Зенит» — знает только сервис,
  // потому что он читает текущий матч и сливает с патчем.
  //
  // Проверка tourNumber ↔ format здесь НЕ нужна: stageId
  // не меняется, значит format тот же, что при create.
  //
  // Репозиторий сам проверит существование города и команд
  // (если они меняются) внутри транзакции.
  // ============================================================
  async update(data: UpdateMatchData): Promise<Match> {
    const current = await this.repository.findById(data.id);
    if (!current) {
      throw new NotFoundException(`Match with id ${data.id} not found`);
    }

    // Целевые значения команд с учётом частичного патча.
    // `undefined` — не трогаем, `null` — обнуляем, значение — меняем.
    const nextHomeTeamId =
      data.homeTeamId !== undefined ? data.homeTeamId : current.homeTeamId;
    const nextAwayTeamId =
      data.awayTeamId !== undefined ? data.awayTeamId : current.awayTeamId;

    if (
      nextHomeTeamId !== null &&
      nextAwayTeamId !== null &&
      nextHomeTeamId === nextAwayTeamId
    ) {
      throw new BadRequestException(
        'homeTeamId and awayTeamId must be different',
      );
    }

    const updated = await this.repository.updatePartial(data);
    if (!updated) {
      // Запись могли удалить между findById и updatePartial —
      // трактуем так же, как «не найдено».
      throw new NotFoundException(`Match with id ${data.id} not found`);
    }
    return updated;
  }

  // ============================================================
  // DELETE
  //
  // Репозиторий делает простое удаление. Проверка «есть ли
  // назначения на матч» появится позже, когда будет
  // AssignmentRepository. Тогда delete станет транзакционным
  // и будет бросать DbForeignKeyViolationException.
  // ============================================================
  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }
  }

  // ============================================================
  // DELETE ALL BY STAGE
  //
  // Каскад при удалении этапа. Вызывается из StageService
  // при каскадном удалении (если понадобится).
  //
  // В публичный HTTP API не выходит.
  // ============================================================
  async deleteAllByStage(stageId: string): Promise<void> {
    await this.repository.deleteAllByStage(stageId);
  }

  // ============================================================
  // DELETE ALL BY TOURNAMENT
  //
  // Каскад при удалении турнира. Вызывается из TournamentService
  // при каскадном удалении.
  //
  // В публичный HTTP API не выходит.
  // ============================================================
  async deleteAllByTournament(tournamentId: string): Promise<void> {
    await this.repository.deleteAllByTournament(tournamentId);
  }
}
