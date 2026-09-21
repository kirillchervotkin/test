// src/teams/team.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Team,
  CreateTeamData,
  UpdateTeamData,
  TeamFilters,
} from './entities/types/team.types.js';
import { TeamRepository } from './repository/team.repository.js';

/**
 * Сервис управления командами.
 *
 * Тонкая обёртка над {@link TeamRepository}. Вся работа с БД
 * (транзакции, проверка существования города, обработка
 * unique-violation, retry через `idempotent: true`) инкапсулирована
 * в репозитории — сервис не инжектит `DRIZZLE` и не открывает
 * транзакции.
 *
 * Сервис добавляет только бизнес-семантику: перевод `null` в
 * {@link NotFoundException}. Исключения уровня БД
 * (`DbUniqueViolationException`, `DbForeignKeyViolationException`)
 * не трогаются — они транслируются в HTTP глобальным фильтром.
 *
 * Команда — глобальный справочник, не привязана к турниру.
 * Поэтому нет compound-методов (в отличие от stage).
 */
@Injectable()
export class TeamService {
  constructor(private readonly repository: TeamRepository) {}

  // ============================================================
  // CREATE
  //
  // Репозиторий открывает транзакцию, проверяет существование
  // города (если cityId задан), делает INSERT. При нарушении
  // FK/unique бросает Db*ViolationException — фильтр превратит
  // в 4xx.
  // ============================================================
  async create(data: CreateTeamData): Promise<Team> {
    return this.repository.create(data);
  }

  // ============================================================
  // FIND BY ID
  //
  // Возвращает `null`, если команды нет. Контроллер сам решает,
  // что с этим делать (обычно — NotFoundException).
  // ============================================================
  async findById(id: string): Promise<Team | null> {
    return this.repository.findById(id);
  }

  // ============================================================
  // FIND BY NAME
  //
  // Точное совпадение по имени. Возвращает `null`, если команды
  // с таким именем нет.
  // ============================================================
  async findByName(name: string): Promise<Team | null> {
    return this.repository.findByName(name);
  }

  // ============================================================
  // FIND BY CITY
  //
  // Все команды с указанным домашним городом. Возвращает пустой
  // массив, если таких команд нет.
  // ============================================================
  async findByCity(cityId: string): Promise<Team[]> {
    return this.repository.findByCity(cityId);
  }

  // ============================================================
  // SEARCH BY NAME
  //
  // Частичное совпадение (LIKE %query%) для автокомплита.
  // Возвращает пустой массив, если ничего не найдено.
  // ============================================================
  async searchByName(query: string): Promise<Team[]> {
    return this.repository.searchByName(query);
  }

  // ============================================================
  // FIND ALL (фильтры + сортировка, без пагинации)
  //
  // Команд в системе сотни максимум, поэтому пагинация не нужна.
  // Отдаём всё сразу, с фильтрами и сортировкой.
  // ============================================================
  async findAll(params: {
    filter?: TeamFilters;
    orderBy?: 'name' | 'shortName';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<Team[]> {
    return this.repository.findAll(
      params.filter,
      params.orderBy ?? 'name',
      params.orderDir ?? 'ASC',
    );
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Бросает NotFoundException, если команды нет.
  //
  // `shortName: null` и `cityId: null` — допустимые значения
  // для обнуления соответствующих полей. Проверка существования
  // нового города (если cityId меняется на не-null) выполняется
  // в репозитории внутри транзакции.
  //
  // Двойная проверка `null` (на findById и на updatePartial) —
  // как в CityService.update: запись могли удалить между
  // двумя вызовами.
  // ============================================================
  async update(data: UpdateTeamData): Promise<Team> {
    const current = await this.repository.findById(data.id);
    if (!current) {
      throw new NotFoundException(`Team with id ${data.id} not found`);
    }

    const updated = await this.repository.updatePartial(data);
    if (!updated) {
      // Запись могли удалить между findById и updatePartial —
      // трактуем так же, как «не найдено».
      throw new NotFoundException(`Team with id ${data.id} not found`);
    }
    return updated;
  }

  // ============================================================
  // DELETE
  //
  // Репозиторий делает простое удаление. Проверка «есть ли матчи
  // с участием команды» появится позже, когда будет
  // MatchRepository. Тогда delete станет транзакционным и будет
  // бросать DbForeignKeyViolationException при наличии ссылок.
  //
  // Если команды нет — возвращает null, и сервис бросает
  // NotFoundException.
  // ============================================================
  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Team with id ${id} not found`);
    }
    // Foreign key violations (когда появятся) будут брошены
    // репозиторием и проброшены вверх.
  }
}
