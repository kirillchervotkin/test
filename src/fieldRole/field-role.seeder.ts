// src/fieldRole/field-role.seeder.ts

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FieldRoleRepository } from './repository/field-role.repository.js';

/**
 * Базовые роли на поле.
 *
 * Используются для автосоздания в dev-окружении. В prod роли
 * создаются вручную (через API или SQL) — сидер не срабатывает.
 *
 * `code` — программный идентификатор (ключ локализации на фронте).
 * `name` — русское отображаемое имя (fallback для UI).
 * `sortOrder` — порядок отображения в UI.
 */
const DEFAULT_ROLES = [
  { code: 'REFEREE', name: 'Главный судья', sortOrder: 1 },
  { code: 'ASSISTANT', name: 'Помощник судьи', sortOrder: 2 },
  { code: 'RESERVE', name: 'Резервный судья', sortOrder: 3 },
  { code: 'VAR', name: 'VAR', sortOrder: 4 },
  { code: 'AVAR', name: 'AVAR', sortOrder: 5 },
] as const;

/**
 * Сидер справочника ролей.
 *
 * Поведение:
 *   - В dev (NODE_ENV=development): проверяет, что все 5 базовых
 *     ролей существуют. Если какой-то нет — создаёт её.
 *     Самовосстанавливающийся: если админ случайно удалил роль,
 *     при следующем рестарте она вернётся.
 *   - В prod и других средах: ничего не делает. Роли создаются
 *     вручную один раз при первом деплое.
 *
 * UUID генерируются репозиторием через uuidv4() — как везде.
 * Никто не ссылается на UUID ролей напрямую, только на `code`.
 */
@Injectable()
export class FieldRoleSeeder implements OnModuleInit {
  private readonly logger = new Logger(FieldRoleSeeder.name);

  constructor(
    private readonly repository: FieldRoleRepository,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const env = this.configService.get<string>('NODE_ENV');

    // Сидим только в dev. В prod — вручную.
    if (env !== 'development') {
      this.logger.log(
        `Field role seeding skipped (NODE_ENV=${env ?? 'undefined'}). ` +
          `In production, create roles manually via POST /field-roles or SQL.`,
      );
      return;
    }

    const created: string[] = [];

    for (const role of DEFAULT_ROLES) {
      const existing = await this.repository.findByCode(role.code);
      if (!existing) {
        await this.repository.create(role);
        created.push(role.code);
      }
    }

    if (created.length > 0) {
      this.logger.log(
        `Field role seeding completed. Created: ${created.join(', ')}`,
      );
    } else {
      this.logger.log('Field role seeding completed. All roles already exist.');
    }
  }
}
