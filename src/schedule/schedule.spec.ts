import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BergerAlgorithm } from './algorithms/berger.js';
import { ScheduleGeneratorService } from './schedule-generator.service.js';
import {
  StandingsService,
  BracketResolverService,
} from './bracket-resolver.service.js';
import {
  ScheduleIntegrityService,
  StageService,
  ScheduleMatchService,
} from './schedule-crud.service.js';
import { TournamentFactoryService } from './tournament-factory.service.js';
import type {
  ScheduleRepository,
  ScheduleStore,
} from './repository/schedule.repository.js';
import type {
  Table,
  Tables,
  Entity,
  Stage,
  TeamSlot,
  Match,
} from './entities/types/schedule.types.js';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
class MemoryStore implements ScheduleStore {
  data: Record<Table, Map<string, unknown>> = {
    cities: new Map([
      [
        uuid(1),
        {
          id: uuid(1),
          name: 'Город',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ],
    ]),
    teams: new Map(
      Array.from({ length: 256 }, (_, i) => [
        uuid(i + 1),
        {
          id: uuid(i + 1),
          name: 'Команда',
          cityId: uuid(1),
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      ]),
    ),
    tournaments: new Map(),
    stages: new Map(),
    matches: new Map(),
    tournament_team_slots: new Map(),
    bracket_slots: new Map(),
    tournament_templates: new Map(),
  };
  next = 1000;
  async stamp(): Promise<Entity> {
    const now = '2026-01-01T00:00:00.000Z';
    return { id: String(this.next++), createdAt: now, updatedAt: now };
  }
  async get<K extends Table>(table: K, id: string): Promise<Tables[K]> {
    const r = this.data[table].get(id);
    if (!r) throw new NotFoundException();
    return structuredClone(r) as Tables[K];
  }
  async list<K extends Table>(
    table: K,
    where: Partial<Tables[K]> = {},
  ): Promise<Tables[K][]> {
    return structuredClone(
      [...this.data[table].values()].filter((v) =>
        Object.entries(where).every(
          ([k, x]) => (v as Record<string, unknown>)[k] === x,
        ),
      ),
    ) as Tables[K][];
  }
  async save<K extends Table>(
    table: K,
    value: Tables[K],
    insert = false,
  ): Promise<Tables[K]> {
    if (insert && this.data[table].has(value.id)) throw new ConflictException();
    this.data[table].set(value.id, structuredClone(value));
    return value;
  }
  async remove<K extends Table>(table: K, id: string): Promise<void> {
    this.data[table].delete(id);
  }
  async transaction<T>(action: (db: ScheduleStore) => Promise<T>): Promise<T> {
    const before = structuredClone(this.data);
    try {
      return await action(this);
    } catch (e) {
      this.data = before;
      throw e;
    }
  }
  async read<T>(action: (db: ScheduleStore) => Promise<T>): Promise<T> {
    return action(this);
  }
}
const integrity = new ScheduleIntegrityService(
  { findOne: async () => ({}) } as never,
  { findOne: async () => ({}) } as never,
);
async function fixture(
  format: Stage['format'],
  count: number,
  settings: Stage['settings'] = {},
) {
  const db = new MemoryStore(),
    repo = db as unknown as ScheduleRepository;
  await db.save('tournaments', {
    ...(await db.stamp()),
    id: '1',
    name: 'Тест',
    season: '2026',
    type: 'CUP',
    startDate: '2026-01-01',
    endDate: '2028-12-31',
    templateId: null,
  });
  await db.save('stages', {
    ...(await db.stamp()),
    id: '2',
    tournamentId: '1',
    parentStageId: null,
    type: 'STAGE',
    format,
    name: 'Этап',
    sortOrder: 0,
    settings,
  });
  for (let i = 0; i < count; i++)
    await db.save('tournament_team_slots', {
      ...(await db.stamp()),
      id: String(i + 10),
      tournamentId: '1',
      stageId: '2',
      groupName: null,
      slotName: `Слот ${i + 1}`,
      seed: i + 1,
      teamId: uuid(i + 100),
    });
  const gen = new ScheduleGeneratorService(repo, integrity),
    standings = new StandingsService(repo),
    resolver = new BracketResolverService(repo, standings);
  return { db, repo, gen, standings, resolver };
}
describe('Бергер', () => {
  for (const n of [2, 3, 4, 5, 8, 15])
    it(`${n} слотов: пары и туры`, async () => {
      const ids = Array.from({ length: n }, (_, i) => String(i + 1)),
        matches = await BergerAlgorithm.generate(ids, 2);
      expect(matches).toHaveLength(n * (n - 1));
      const pairs = new Set(
        matches.map((m) => `${m.homeSlotId}:${m.awaySlotId}`),
      );
      expect(pairs.size).toBe(n * (n - 1));
      for (const round of new Set(matches.map((m) => m.round))) {
        const participants = matches
          .filter((m) => m.round === round)
          .flatMap((m) => [m.homeSlotId, m.awaySlotId]);
        expect(new Set(participants).size).toBe(participants.length);
      }
    });
});
describe('Календарь и резолвер', () => {
  it('генерирует один раз и откатывает выход за диапазон дат', async () => {
    const { db, gen } = await fixture('ROUND_ROBIN', 4);
    await gen.generate('1', { cityId: uuid(1) });
    await expect(gen.generate('1', { cityId: uuid(1) })).rejects.toBeInstanceOf(
      ConflictException,
    );
    const second = await fixture('ROUND_ROBIN', 4);
    await expect(
      second.gen.generate('1', {
        cityId: uuid(1),
        firstMatchDate: '2028-12-31',
        intervalDays: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(await second.db.list('matches')).toHaveLength(0);
  });
  for (const n of [2, 3, 4, 5, 8, 16])
    for (const format of ['SINGLE_ELIM', 'DOUBLE_ELIM'] as const)
      it(`${format}, ${n}: полное прохождение с bye`, async () => {
        const { db, gen, resolver } = await fixture(format, n, {
          grandFinalReset: true,
        });
        const matches = await gen.generate('1', { cityId: uuid(1) });
        expect(matches.length).toBeGreaterThanOrEqual(n - 1);
        for (let pass = 0; pass < 50; pass++) {
          await resolver.resolve('2');
          let changed = false;
          for (const m of await db.list('matches'))
            if (m.homeTeamId && m.awayTeamId && m.homeScore === null) {
              expect(m.homeTeamId).not.toBe(m.awayTeamId);
              await db.save('matches', { ...m, homeScore: 2, awayScore: 0 });
              changed = true;
            }
          if (!changed) break;
        }
        const stage = await db.get('stages', '2');
        const all = await db.list('matches');
        const reset = stage.settings?.generated?.reset;
        const resetIds = reset
          ? stage.settings!.generated!.series[reset.resetId]
          : [];
        expect(
          all
            .filter((m) => !resetIds.includes(m.id))
            .every((m) => m.homeScore !== null),
        ).toBe(true);
        const first = await resolver.resolve('2');
        expect(await resolver.resolve('2')).toEqual(first);
      });
  it('блокирует изменение первой игры серии после прохода победителя', async () => {
    const { db, repo, gen, resolver } = await fixture('SINGLE_ELIM', 4, {
      legsPerRound: 2,
    });
    await gen.generate('1', { cityId: uuid(1) });
    await new StageService(repo, integrity).update('2', { name: 'Новое имя' });
    const stage = await db.get('stages', '2');
    expect(stage.name).toBe('Новое имя');
    const ids = Object.values(stage.settings!.generated!.series)[0];
    for (const id of ids) {
      const match = await db.get('matches', id);
      await db.save('matches', {
        ...match,
        homeScore: match.homeTeamId === uuid(100) ? 3 : 0,
        awayScore: match.awayTeamId === uuid(100) ? 3 : 0,
      });
    }
    await resolver.resolve('2');
    const matches = new ScheduleMatchService(repo, integrity);
    await expect(
      matches.update(ids[0], { homeScore: 0, awayScore: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('откатывает циклическую квалификацию групп до создания матчей', async () => {
    const { db, gen } = await fixture('ROUND_ROBIN', 2);
    const stage = await db.get('stages', '2');
    await db.save('stages', {
      ...stage,
      settings: {
        qualification: [
          {
            slotName: 'Слот 1',
            sourceType: 'GROUP',
            sourceStageId: '2',
            sourcePosition: 1,
          },
        ],
      },
    });
    await expect(gen.generate('1', { cityId: uuid(1) })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(await db.list('matches')).toHaveLength(0);
  });
  it('двухматчевую серию решает по сумме, ничью оставляет неразрешённой', async () => {
    const { db, gen, resolver } = await fixture('SINGLE_ELIM', 4, {
      legsPerRound: 2,
    });
    await gen.generate('1', { cityId: uuid(1) });
    const stage = await db.get('stages', '2'),
      [last, ids] = Object.entries(stage.settings!.generated!.series)[0];
    const a = await db.get('matches', ids[0]),
      b = await db.get('matches', ids[1]);
    await db.save('matches', { ...a, homeScore: 2, awayScore: 0 });
    expect(await resolver.result(db, last)).toBeNull();
    await db.save('matches', { ...b, homeScore: 2, awayScore: 0 });
    expect(await resolver.result(db, last)).toBeNull();
    await db.save('matches', { ...b, homeScore: 1, awayScore: 0 });
    expect((await resolver.result(db, last))?.winner).toBe(a.homeTeamId);
  });
  it('повторный финал активен только после поражения победителя верхней сетки', async () => {
    const { db, gen, resolver } = await fixture('DOUBLE_ELIM', 2, {
      grandFinalReset: true,
    });
    await gen.generate('1', { cityId: uuid(1) });
    const stage = await db.get('stages', '2'),
      reset = stage.settings!.generated!.reset!;
    const opening = (await db.list('matches')).find(
      (m) => m.homeTeamId && m.awayTeamId,
    )!;
    await db.save('matches', { ...opening, homeScore: 1, awayScore: 0 });
    await resolver.resolve('2');
    const final = await db.get('matches', reset.finalId);
    await db.save('matches', { ...final, homeScore: 0, awayScore: 1 });
    await resolver.resolve('2');
    const replay = await db.get('matches', reset.resetId);
    expect(replay.homeTeamId).toBe(final.awayTeamId);
    expect(replay.awayTeamId).toBe(final.homeTeamId);
  });
  it('считает нулевые результаты и не выбирает победителя при равных критериях', async () => {
    const { db, gen, standings } = await fixture('ROUND_ROBIN', 3, {
      pointsForDraw: 2,
      tieBreakers: ['headToHead', 'goalDifference'],
    });
    await gen.generate('1', { cityId: uuid(1) });
    for (const m of await db.list('matches'))
      await db.save('matches', { ...m, homeScore: 0, awayScore: 0 });
    const table = await standings.calculate('2');
    expect(
      table.every((r) => r.points === 4 && r.tied && r.position === 1),
    ).toBe(true);
  });
  it('запрещает цикл родительских этапов', async () => {
    const { db, repo } = await fixture('ROUND_ROBIN', 0);
    const stages = new StageService(repo, integrity);
    const child = await stages.create('1', {
      name: 'Группа',
      type: 'GROUP',
      format: 'ROUND_ROBIN',
      sortOrder: 0,
      parentStageId: '2',
    });
    await expect(
      stages.update('2', { parentStageId: child.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('шаблон группы + плей-офф разворачивается атомарно; незавершённая группа не квалифицирует', async () => {
    const { db, repo } = await fixture('ROUND_ROBIN', 2);
    const gen = new ScheduleGeneratorService(repo, integrity),
      resolver = new BracketResolverService(repo, new StandingsService(repo));
    await db.save('tournament_templates', {
      ...(await db.stamp()),
      id: '99',
      name: 'Кубок',
      description: null,
      version: 1,
      isActive: true,
      schema: {
        name: 'Кубок',
        type: 'CUP',
        cityId: uuid(1),
        stages: [
          {
            key: 'group',
            name: 'Группа',
            type: 'GROUP',
            format: 'ROUND_ROBIN',
            slots: [
              { name: 'A', teamId: uuid(100) },
              { name: 'B', teamId: uuid(101) },
            ],
          },
          {
            key: 'final',
            name: 'Финал',
            type: 'PLAYOFF',
            format: 'SINGLE_ELIM',
            slots: [{ name: 'Первый' }, { name: 'Второй' }],
            settings: {
              qualification: [
                {
                  slotName: 'Первый',
                  sourceType: 'GROUP',
                  sourceStageKey: 'group',
                  sourcePosition: 1,
                },
                {
                  slotName: 'Второй',
                  sourceType: 'GROUP',
                  sourceStageKey: 'group',
                  sourcePosition: 2,
                },
              ],
            },
          },
        ],
      },
    });
    const factory = new TournamentFactoryService(repo, gen, integrity),
      t = await factory.createFromTemplate(
        '99',
        '2026',
        '2026-01-01',
        '2027-12-31',
      );
    const stages = await db.list('stages', { tournamentId: t.id }),
      final = stages.find((s) => s.name === 'Финал')!,
      group = stages.find((s) => s.name === 'Группа')!;
    expect(
      (await resolver.resolve(final.id)).every(
        (b) => b.resolvedTeamId === null,
      ),
    ).toBe(true);
    const match = (await db.list('matches', { stageId: group.id }))[0];
    expect(
      (await db.list('matches', { stageId: final.id }))[0].matchDate >
        match.matchDate,
    ).toBe(true);
    await db.save('matches', { ...match, homeScore: 2, awayScore: 0 });
    expect(
      (await resolver.resolve(final.id)).every(
        (b) => b.resolvedTeamId !== null,
      ),
    ).toBe(true);
  });
});
