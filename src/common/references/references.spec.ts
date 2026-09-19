import { randomUUID } from 'node:crypto';
import { DbUniqueViolationException } from '../exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../exceptions/db-foreign-key-violation.exception.js';
import { describe, it, expect } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CityRepository } from '../../city/repository/city.repository.js';
import { TeamRepository } from '../../team/repository/team.repository.js';
import { YdbCityService } from '../../city/city.service.js';
import { YdbTeamService } from '../../team/team.service.js';
import {
  ScheduleRepository,
  type ScheduleStore,
} from '../../schedule/repository/schedule.repository.js';
import type {
  Table,
  Tables,
} from '../../schedule/entities/types/schedule.types.js';
import { scheduleSchema } from '../../schedule/entities/schedule.schema.js';
import { ReferenceValidation } from './reference-validation.js';

function fixture() {
  const rows = Object.fromEntries(
    Object.keys(scheduleSchema).map((k) => [k, new Map()]),
  ) as Record<Table, Map<string, unknown>>;
  const db: ScheduleStore = {
    async stamp() {
      return {
        id: '1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    async get<K extends Table>(table: K, id: string): Promise<Tables[K]> {
      const row = rows[table].get(id);
      if (!row) throw new NotFoundException();
      return structuredClone(row) as Tables[K];
    },
    async list<K extends Table>(
      table: K,
      where: Partial<Tables[K]> = {},
    ): Promise<Tables[K][]> {
      return [...rows[table].values()].filter((row) =>
        Object.entries(where).every(
          ([k, v]) => (row as Record<string, unknown>)[k] === v,
        ),
      ) as Tables[K][];
    },
    async save<K extends Table>(
      table: K,
      row: Tables[K],
      insert = false,
    ): Promise<Tables[K]> {
      if (insert && rows[table].has(row.id)) throw new ConflictException();
      rows[table].set(row.id, structuredClone(row));
      return row;
    },
    async remove(table, id) {
      rows[table].delete(id);
    },
  };
  const repository = {
    read: async (fn: (db: ScheduleStore) => Promise<unknown>) => fn(db),
    transaction: async (fn: (db: ScheduleStore) => Promise<unknown>) => fn(db),
  } as ScheduleRepository;
  return {
    rows,
    db,
    cities: new YdbCityService(new CityRepository(repository)),
    teams: new YdbTeamService(new TeamRepository(repository)),
  };
}
describe('Постоянные справочники', () => {
  it('нормализует названия, блокирует дубликаты и сохраняет UUID', async () => {
    const f = fixture();
    const city = await f.cities.create({ name: '  Москва  ' });
    expect(city.name).toBe('Москва');
    expect(city.id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(f.cities.create({ name: 'москва' })).rejects.toBeInstanceOf(
      DbUniqueViolationException,
    );
    expect(await f.cities.searchByName('МОС')).toHaveLength(1);
    expect((await f.cities.update(city.id, { name: 'Казань' })).createdAt).toBe(
      city.createdAt,
    );
  });
  it('команда требует существующий город; название уникально в пределах города', async () => {
    const f = fixture();
    await expect(
      f.teams.create({ name: 'Команда', cityId: randomUUID() }),
    ).rejects.toBeInstanceOf(DbForeignKeyViolationException);
    const a = await f.cities.create({ name: 'A' }),
      b = await f.cities.create({ name: 'B' });
    const t = await f.teams.create({ name: 'Команда', cityId: a.id });
    await f.teams.create({ name: 'Команда', cityId: b.id });
    await expect(f.teams.update(t.id, { cityId: b.id })).rejects.toBeInstanceOf(
      DbUniqueViolationException,
    );
    await expect(f.cities.remove(a.id)).rejects.toBeInstanceOf(
      DbForeignKeyViolationException,
    );
    await f.teams.remove(t.id);
    await f.cities.remove(a.id);
  });
  it.each(['tournament_team_slots', 'matches', 'bracket_slots'] as const)(
    'не удаляет команду со ссылкой из %s',
    async (table) => {
      const f = fixture(),
        c = await f.cities.create({ name: 'Город' }),
        t = await f.teams.create({ name: 'Команда', cityId: c.id });
      const field =
        table === 'matches'
          ? 'awayTeamId'
          : table === 'bracket_slots'
            ? 'resolvedTeamId'
            : 'teamId';
      f.rows[table].set('link', { id: 'link', [field]: String(t.id) });
      await expect(f.teams.remove(t.id)).rejects.toBeInstanceOf(
        DbForeignKeyViolationException,
      );
      expect(await f.teams.findOne(t.id)).toEqual(t);
    },
  );
  it('защищает ссылки шаблона, включая вложенные этапы', async () => {
    const f = fixture(),
      c = await f.cities.create({ name: 'Город' }),
      t = await f.teams.create({ name: 'Команда', cityId: c.id });
    f.rows.tournament_templates.set('1', {
      id: '1',
      schema: {
        cityId: String(c.id),
        stages: [{ children: [{ slots: [{ teamId: String(t.id) }] }] }],
      },
    });
    await expect(f.teams.remove(t.id)).rejects.toBeInstanceOf(
      DbForeignKeyViolationException,
    );
    await expect(f.cities.remove(c.id)).rejects.toBeInstanceOf(
      DbForeignKeyViolationException,
    );
  });
  it.each(['matches', 'tournament_templates'] as const)(
    'не удаляет город со ссылкой из %s без команд',
    async (table) => {
      const f = fixture(),
        city = await f.cities.create({ name: 'Город' });
      f.rows[table].set(
        '1',
        table === 'matches'
          ? { id: '1', cityId: String(city.id) }
          : { id: '1', schema: { cityId: String(city.id), stages: [] } },
      );
      await expect(f.cities.remove(city.id)).rejects.toBeInstanceOf(
        DbForeignKeyViolationException,
      );
    },
  );
  it('проверяет ссылки до сохранения шаблона', async () => {
    const f = fixture();
    await expect(
      ReferenceValidation.template(f.db, {
        cityId: randomUUID(),
        stages: [],
      } as never),
    ).rejects.toBeInstanceOf(DbForeignKeyViolationException);
  });
  it('отклоняет пустые названия, null и неUUID', async () => {
    const f = fixture();
    await expect(f.cities.create({ name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(f.cities.findOne('123')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    const c = await f.cities.create({ name: 'Город' });
    await expect(
      f.cities.update(c.id, { name: null } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('Ошибки транзакций YDB', () => {
  it.each(['read', 'transaction'] as const)(
    'сохраняет HTTP-ошибку после %s',
    async (method) => {
      const conflict = new ConflictException('Дубликат');
      const repository = new ScheduleRepository({
        begin: async () => {
          throw new Error('Transaction failed.', { cause: conflict });
        },
      } as never);
      await expect(repository[method](async () => null)).rejects.toBe(conflict);
    },
  );
  it('не скрывает ошибки инфраструктуры', async () => {
    const failure = new Error('Transaction failed.', {
      cause: new Error('Connection failed'),
    });
    const repository = new ScheduleRepository({
      begin: async () => {
        throw failure;
      },
    } as never);
    await expect(repository.read(async () => null)).rejects.toBe(failure);
  });
});
