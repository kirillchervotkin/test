// src/field-roles/field-role.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  FieldRole,
  CreateFieldRoleData,
  UpdateFieldRoleData,
  FieldRoleFilters,
} from './entities/types/field-role.types.js';
import { FieldRoleRepository } from './repository/field-role.repository.js';

/**
 * Сервис управления ролями на поле.
 *
 * Тонкая обёртка над {@link FieldRoleRepository}. Вся работа с БД
 * (обработка unique-violation) инкапсулирована в репозитории —
 * сервис не инжектит `DRIZZLE` и не открывает транзакции.
 *
 * Сервис добавляет только бизнес-семантику: перевод `null` в
 * {@link NotFoundException}. Исключения уровня БД
 * (`DbUniqueViolationException`) не трогаются — они транслируются
 * в HTTP глобальным фильтром.
 *
 * Роль — глобальный справочник, не привязана к турниру.
 * Поэтому нет compound-методов (в отличие от stage).
 *
 * Транзакции не нужны: нет FK-проверок, нет связанных записей,
 * которые надо менять атомарно. Все операции — одиночные
 * INSERT / UPDATE / DELETE.
 */
@Injectable()
export class FieldRoleService {
  constructor(private readonly repository: FieldRoleRepository) {}

  // ============================================================
  // CREATE
  //
  // Репозиторий генерирует UUID, делает INSERT. При нарушении
  // уникальности `code` бросает DbUniqueViolationException —
  // фильтр превратит в 409.
  // ============================================================
  async create(data: CreateFieldRoleData): Promise<FieldRole> {
    return this.repository.create(data);
  }

  // ============================================================
  // FIND BY ID
  //
  // Возвращает `null`, если роли нет. Контроллер сам решает,
  // что с этим делать (обычно — NotFoundException).
  // ============================================================
  async findById(id: string): Promise<FieldRole | null> {
    return this.repository.findById(id);
  }

  // ============================================================
  // FIND BY CODE
  //
  // Точное совпадение по коду. Используется в бизнес-логике
  // (например, «найти REFEREE»). Возвращает `null`, если роли
  // с таким кодом нет.
  // ============================================================
  async findByCode(code: string): Promise<FieldRole | null> {
    return this.repository.findByCode(code);
  }

  // ============================================================
  // FIND ALL (фильтры + сортировка, без пагинации)
  //
  // Ролей фиксированное количество (5), пагинация не нужна.
  // По умолчанию сортировка по sortOrder — естественный порядок
  // отображения в UI (Главный судья, Помощник, Резервный, VAR, AVAR).
  // ============================================================
  async findAll(params: {
    filter?: FieldRoleFilters;
    orderBy?: 'sortOrder' | 'code' | 'name';
    orderDir?: 'ASC' | 'DESC';
  }): Promise<FieldRole[]> {
    return this.repository.findAll(
      params.filter,
      params.orderBy ?? 'sortOrder',
      params.orderDir ?? 'ASC',
    );
  }

  // ============================================================
  // UPDATE PARTIAL
  //
  // Бросает NotFoundException, если роли нет.
  //
  // `null` в патче не допускается: у роли нет nullable-полей.
  // Семантика `undefined` vs значение:
  //   - `undefined` — не трогаем.
  //   - значение — заменить.
  //
  // `code` можно менять, но осторожно: он используется в
  // бизнес-логике и как ключ локализации. Если новый код уже
  // занят — DbUniqueViolationException (409).
  //
  // Двойная проверка `null` (на findById и на updatePartial) —
  // как в CityService.update: запись могли удалить между
  // двумя вызовами.
  // ============================================================
  async update(data: UpdateFieldRoleData): Promise<FieldRole> {
    const current = await this.repository.findById(data.id);
    if (!current) {
      throw new NotFoundException(`Field role with id ${data.id} not found`);
    }

    const updated = await this.repository.updatePartial(data);
    if (!updated) {
      // Запись могли удалить между findById и updatePartial —
      // трактуем так же, как «не найдено».
      throw new NotFoundException(`Field role with id ${data.id} not found`);
    }
    return updated;
  }

  // ============================================================
  // DELETE
  //
  // Репозиторий делает простое удаление. Проверка «есть ли
  // назначения с этой ролью» появится позже, когда будет
  // AssignmentRepository. Тогда delete станет транзакционным
  // и будет бросать DbForeignKeyViolationException при наличии
  // ссылок.
  //
  // Если роли нет — возвращает null, и сервис бросает
  // NotFoundException.
  // ============================================================
  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Field role with id ${id} not found`);
    }
  }
}
