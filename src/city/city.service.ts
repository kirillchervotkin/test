// src/cities/city.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  City,
  CreateCityData,
  UpdateCityData,
  CityFilters,
} from './entities/types/city.types.js';
import { CityRepository } from './repository/city.repository.js';

/**
 * Сервис управления городами.
 *
 * Тонкая обёртка над {@link CityRepository}. Вся работа с БД
 * (транзакции, обработка unique-violation, retry через
 * `idempotent: true`) инкапсулирована в репозитории — сервис не
 * инжектит `DRIZZLE` и не открывает транзакции.
 *
 * Сервис добавляет только бизнес-семантику: перевод `null` в
 * {@link NotFoundException}. Исключения уровня БД
 * (`DbUniqueViolationException`, `DbForeignKeyViolationException`)
 * не трогаются — они транслируются в HTTP глобальным фильтром.
 *
 * Город — глобальный справочник, не привязан к турниру.
 * Поэтому нет compound-методов (в отличие от stage).
 */
@Injectable()
export class CityService {
  constructor(private readonly repository: CityRepository) {}

  // ============================================================
  // CREATE
  //
  // Репозиторий генерирует UUID, проставляет createdAt/updatedAt
  // и делает INSERT. При нарушении unique-ограничения бросает
  // DbUniqueViolationException — фильтр превратит в 409.
  // ============================================================
  async create(data: CreateCityData): Promise<City> {
    return this.repository.create(data);
  }

  // ============================================================
  // FIND BY ID
  //
  // Возвращает `null`, если города нет. Контроллер сам решает,
  // что с этим делать (обычно — NotFoundException).
  // ============================================================
  async findById(id: string): Promise<City | null> {
    return this.repository.findById(id);
  }

  // ============================================================
  // FIND BY NAME
  //
  // Точное совпадение по имени. Возвращает `null`, если города
  // с таким именем нет. Используется для проверки дубликатов
  // на уровне сервиса, если понадобится.
  // ============================================================
  async findByName(name: string): Promise<City | null> {
    return this.repository.findByName(name);
  }

  // ============================================================
  // SEARCH BY NAME
  //
  // Частичное совпадение (LIKE %query%) для автокомплита.
  // Возвращает пустой массив, если ничего не найдено.
  // ============================================================
  async searchByName(query: string): Promise<City[]> {
    return this.repository.searchByName(query);
  }

  // ============================================================
  // FIND ALL (фильтры + сортировка, без пагинации)
  //
  // Городов в системе сотни максимум, поэтому пагинация не нужна.
  // Отдаём всё сразу, с фильтрами и сортировкой.
  // ============================================================
  async findAll(params: {
    filter?: CityFilters;
    orderBy?: 'name' | 'region' | 'createdAt';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<City[]> {
    return this.repository.findAll(
      params.filter,
      params.orderBy ?? 'name',
      params.orderDir ?? 'ASC',
    );
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Бросает NotFoundException, если города нет. `region` допускает
  // явный `null` — «очистить регион».
  //
  // Двойная проверка `null` (на findById и на updatePartial) —
  // как в TestTypeService.update: запись могли удалить между
  // двумя вызовами.
  // ============================================================
  async update(data: UpdateCityData): Promise<City> {
    const current = await this.repository.findById(data.id);
    if (!current) {
      throw new NotFoundException(`City with id ${data.id} not found`);
    }

    const updated = await this.repository.updatePartial(data);
    if (!updated) {
      // Запись могли удалить между findById и updatePartial —
      // трактуем так же, как «не найдено».
      throw new NotFoundException(`City with id ${data.id} not found`);
    }
    return updated;
  }

  // ============================================================
  // DELETE
  //
  // Репозиторий делает простое удаление. Проверка «есть ли матчи
  // в этом городе» появится позже, когда будет MatchRepository.
  // Тогда delete станет транзакционным и будет бросать
  // DbForeignKeyViolationException при наличии ссылок.
  //
  // Если города нет — возвращает null, и сервис бросает
  // NotFoundException.
  // ============================================================
  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`City with id ${id} not found`);
    }
    // Foreign key violations (когда появятся) будут брошены
    // репозиторием и проброшены вверх.
  }
}
