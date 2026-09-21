// src/stages/stage.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  Stage,
  CreateStageData,
  UpdateStageData,
  isTypeFormatConsistent,
} from './entities/types/stage.types.js';
import { StageRepository } from './repository/stage.repository.js';

/**
 * Сервис управления этапами турнира.
 *
 * Тонкая обёртка над {@link StageRepository}. Вся работа с БД
 * (транзакции, проверки FK, обработка unique-violation, retry через
 * `idempotent: true`) инкапсулирована в репозитории — сервис не
 * инжектит `DRIZZLE` и не открывает транзакции.
 *
 * Сервис добавляет бизнес-семантику:
 *   - перевод `null` в {@link NotFoundException};
 *   - проверку согласованности `type` ↔ `format` при частичном
 *     обновлении (DTO такой проверки сделать не может, потому что
 *     не видит текущего `type` из БД).
 *
 * Публичный API привязан к турниру: этап не существует без турнира,
 * поэтому все методы чтения/записи отдельного этапа принимают
 * `tournamentId` и работают через compound-запросы репозитория
 * (`WHERE id AND tournament_id`). Это гарантирует, что клиент
 * не получит и не изменит этап чужого турнира, даже если угадает id.
 *
 * Исключения уровня БД (`DbUniqueViolationException`,
 * `DbForeignKeyViolationException`) не трогаются — они транслируются
 * в HTTP глобальным фильтром.
 */
@Injectable()
export class StageService {
  constructor(private readonly repository: StageRepository) {}

  // ============================================================
  // CREATE
  //
  // Репозиторий открывает транзакцию, проверяет существование
  // турнира и (если задан) родительского этапа, делает INSERT.
  // Согласованность `type` ↔ `format` проверяется на уровне DTO
  // (CreateStageDto.IsValidStageFormat) — в create-пути сервис
  // не дублирует проверку.
  // ============================================================
  async create(data: CreateStageData): Promise<Stage> {
    return this.repository.create(data);
  }

  // ============================================================
  // FIND BY ID IN TOURNAMENT
  //
  // Возвращает `null`, если этап не найден ИЛИ принадлежит
  // другому турниру. Контроллер сам решает, что с этим делать
  // (обычно — NotFoundException).
  //
  // Проверка принадлежности — на уровне репозитория, одним запросом
  // с `WHERE id AND tournament_id`. Пост-проверки в сервисе нет.
  // ============================================================
  async findByIdInTournament(
    tournamentId: string,
    stageId: string,
  ): Promise<Stage | null> {
    return this.repository.findByIdAndTournament(stageId, tournamentId);
  }

  // ============================================================
  // FIND ALL BY TOURNAMENT
  //
  // Все этапы турнира, включая контейнеры и дочерние.
  // Отсортированы по sortOrder, затем по id.
  // ============================================================
  async findAllByTournament(tournamentId: string): Promise<Stage[]> {
    return this.repository.findAllByTournament(tournamentId);
  }

  // ============================================================
  // FIND ROOT STAGES BY TOURNAMENT
  //
  // Корневые этапы турнира (parentStageId IS NULL). Используется
  // для построения дерева в UI: от корней рекурсивно вызывается
  // findChildren.
  // ============================================================
  async findRootByTournament(tournamentId: string): Promise<Stage[]> {
    return this.repository.findRootByTournament(tournamentId);
  }

  // ============================================================
  // FIND CHILDREN
  //
  // Дочерние этапы относительно указанного родителя. Возвращает
  // пустой массив, если дочерних нет или родителя не существует.
  //
  // Дочерние этапы принадлежат тому же турниру, что и родитель,
  // поэтому отдельная проверка по tournamentId здесь избыточна.
  // ============================================================
  async findChildren(parentStageId: string): Promise<Stage[]> {
    return this.repository.findChildren(parentStageId);
  }

  // ============================================================
  // UPDATE BY ID IN TOURNAMENT
  //
  // В отличие от create, DTO для обновления не видит текущего
  // состояния сущности в БД, поэтому не может проверить
  // согласованность `type` ↔ `format` после слияния патча.
  // Эта проверка выполняется здесь:
  //
  //   1. читаем текущую сущность (в контексте турнира);
  //   2. вычисляем «следующее» состояние (merge патча с текущим);
  //   3. проверяем инвариант isTypeFormatConsistent;
  //   4. только после этого пишем патч в БД.
  //
  // Инварианты:
  //   - STAGE / PLAYOFF → format === null
  //   - GROUP           → format === 'ROUND_ROBIN'
  //   - ROUND           → format === 'ELIMINATION'
  //
  // Пример проблемы, которую это ловит:
  //   PATCH { type: 'GROUP' } на этапе с format='ELIMINATION'
  //   без указания нового format. DTO пропустит (format не передан),
  //   но после merge получится GROUP + ELIMINATION — некорректно.
  //
  // Бросает NotFoundException, если этапа нет или он не принадлежит
  // этому турниру.
  // ============================================================
  async updateInTournament(
    tournamentId: string,
    data: UpdateStageData,
  ): Promise<Stage> {
    const current = await this.repository.findByIdAndTournament(
      data.id,
      tournamentId,
    );
    if (!current) {
      throw new NotFoundException(`Stage with id ${data.id} not found`);
    }

    // Целевые значения полей с учётом частичного патча.
    // Для nullable-полей важно отличать «не передано» (undefined)
    // от «явно обнулено» (null) — см. StageMapper.toUpdateData.
    const nextType = data.type ?? current.type;
    const nextFormat = data.format !== undefined ? data.format : current.format;

    if (!isTypeFormatConsistent({ type: nextType, format: nextFormat })) {
      throw new BadRequestException(
        `Inconsistent type/format combination: ` +
          `type=${nextType}, format=${nextFormat ?? 'null'}. ` +
          `Expected: STAGE/PLAYOFF → null; GROUP → ROUND_ROBIN; ` +
          `ROUND → ELIMINATION.`,
      );
    }

    const updated = await this.repository.updateByIdAndTournament(
      data.id,
      tournamentId,
      data,
    );
    if (!updated) {
      // Запись могли удалить между findByIdAndTournament и
      // updateByIdAndTournament — трактуем так же, как «не найдено».
      throw new NotFoundException(`Stage with id ${data.id} not found`);
    }
    return updated;
  }

  // ============================================================
  // DELETE BY ID IN TOURNAMENT
  //
  // Репозиторий проверяет наличие дочерних этапов внутри
  // транзакции. Если они есть — бросает
  // DbForeignKeyViolationException (транслируется в 409).
  // Если этапа нет или он не принадлежит турниру — возвращает
  // null, и сервис бросает NotFoundException.
  //
  // Каскадное удаление (этап + дочерние + матчи) — отдельный
  // сценарий, реализуется в сервисном слое при необходимости.
  // Автоматического каскада нет: удаление ветки дерева должно
  // быть явным решением.
  // ============================================================
  async deleteInTournament(
    tournamentId: string,
    stageId: string,
  ): Promise<void> {
    const deleted = await this.repository.deleteByIdAndTournament(
      stageId,
      tournamentId,
    );
    if (!deleted) {
      throw new NotFoundException(`Stage with id ${stageId} not found`);
    }
    // Foreign key violations are thrown by the repository and propagated up.
  }

  // ============================================================
  // DELETE ALL BY TOURNAMENT
  //
  // Каскад при удалении турнира. Удаляет все этапы турнира одним
  // запросом. Порядок (листья → корень) на уровне БД не важен:
  // YDB не enforced FK, а ссылки parentStageId не проверяются
  // движком.
  //
  // Проверка, что у этапов нет матчей, — забота TournamentService
  // или MatchService. Здесь только удаление этапов.
  //
  // Используется сервисным слоем турнира при каскадном удалении.
  // В публичный HTTP API не выходит.
  // ============================================================
  async deleteAllByTournament(tournamentId: string): Promise<void> {
    await this.repository.deleteAllByTournament(tournamentId);
  }
}
