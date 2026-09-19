import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BergerAlgorithm } from './algorithms/berger.js';
import type {
  GenerateOptions,
  Match,
  Settings,
  Source,
  TeamSlot,
} from './entities/types/schedule.types.js';
import type { ScheduleStore } from './repository/schedule.repository.js';
import { ScheduleRepository } from './repository/schedule.repository.js';
import { ScheduleIntegrityService } from './schedule-crud.service.js';
interface Entrant {
  slotId: string;
  source?: Source;
}

@Injectable()
export class ScheduleGeneratorService {
  private readonly logger = new Logger(ScheduleGeneratorService.name);
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly integrity: ScheduleIntegrityService,
  ) {}
  async generate(
    tournamentId: string,
    options: GenerateOptions,
  ): Promise<Match[]> {
    const result = await this.repository.transaction((db) =>
      this.generateIn(db, tournamentId, options),
    );
    this.logger.log(`Создано матчей: ${result.length}; турнир ${tournamentId}`);
    return result;
  }
  async generateIn(
    db: ScheduleStore,
    tournamentId: string,
    options: GenerateOptions,
  ): Promise<Match[]> {
    const tournament = await db.get('tournaments', tournamentId);
    await this.integrity.external('city', options.cityId, db);
    if ((await db.list('matches', { tournamentId })).length)
      throw new ConflictException('Календарь уже существует');
    const stages = (await db.list('stages', { tournamentId })).sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    if (!stages.length) throw new BadRequestException('Добавьте этапы');
    const leaves = stages.filter(
      (stage) => !stages.some((s) => s.parentStageId === stage.id),
    );
    const dependencies = new Map<string, string[]>();
    for (const stage of leaves) {
      const ids: string[] = [];
      for (const rule of stage.settings?.qualification ?? []) {
        if (rule.sourceType !== 'GROUP') continue;
        let source = stages.find((s) => s.id === rule.sourceStageId);
        if (rule.sourceGroupName)
          source = stages.find(
            (s) =>
              s.parentStageId === rule.sourceStageId &&
              s.name === rule.sourceGroupName,
          );
        if (!source || !leaves.some((s) => s.id === source.id))
          throw new BadRequestException(
            'Источник qualification должен быть конечным этапом',
          );
        ids.push(source.id);
      }
      dependencies.set(stage.id, ids);
    }
    const ordered: typeof leaves = [];
    const pending = [...leaves];
    while (pending.length) {
      const index = pending.findIndex((stage) =>
        dependencies
          .get(stage.id)!
          .every((id) => ordered.some((s) => s.id === id)),
      );
      if (index < 0)
        throw new ConflictException('Циклическая зависимость этапов');
      ordered.push(pending.splice(index, 1)[0]);
    }
    const all: Match[] = [];
    for (const stage of ordered) {
      const slots = (
        await db.list('tournament_team_slots', { stageId: stage.id })
      ).sort(
        (a, b) =>
          (a.seed ?? 4294967295) - (b.seed ?? 4294967295) ||
          a.slotName.localeCompare(b.slotName),
      );
      if (slots.length < 2 || slots.length > 128)
        throw new BadRequestException(`Этап ${stage.name}: нужны 2–128 слотов`);
      const generated: NonNullable<Settings['generated']> = {
        series: {},
        roundByMatch: {},
        generatedAt: new Date().toISOString(),
      };
      const settings = stage.settings ?? {};
      const made: Match[] = [];
      let nextRound = 0;
      const interval = options.intervalDays ?? 1;
      const baseline = new Date(
        options.firstMatchDate ?? `${tournament.startDate}T12:00:00.000Z`,
      ).getTime();
      const sourceDates = all
        .filter((m) => dependencies.get(stage.id)!.includes(m.stageId!))
        .map((m) => new Date(m.matchDate).getTime() + interval * 86400000);
      const first = Math.max(baseline, ...sourceDates);
      const make = async (
        home: Entrant,
        away: Entrant,
        round: number,
      ): Promise<Match> => {
        const h = await db.get('tournament_team_slots', home.slotId),
          a = await db.get('tournament_team_slots', away.slotId);
        const date = new Date(
          new Date(first).getTime() + (round - 1) * interval * 86400000,
        );
        if (
          !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) < tournament.startDate ||
          date.toISOString().slice(0, 10) > tournament.endDate
        )
          throw new BadRequestException('Календарь выходит за даты турнира');
        const item: Match = {
          ...(await db.stamp()),
          tournamentId,
          stageId: stage.id,
          cityId: options.cityId,
          matchDate: date.toISOString(),
          homeSlotId: h.id,
          awaySlotId: a.id,
          homeTeamId: h.teamId,
          awayTeamId: a.teamId,
          homeScore: null,
          awayScore: null,
        };
        await db.save('matches', item, true);
        made.push(item);
        generated.roundByMatch[item.id] = round;
        for (const [side, entry] of [
          ['HOME', home],
          ['AWAY', away],
        ] as const) {
          if (entry.source) {
            const r = entry.source;
            await db.save(
              'bracket_slots',
              {
                ...(await db.stamp()),
                matchId: item.id,
                side,
                sourceType: r.sourceType,
                sourceStageId: r.sourceStageId ?? null,
                sourceGroupName: r.sourceGroupName ?? null,
                sourcePosition: r.sourcePosition ?? null,
                sourceMatchId: r.sourceMatchId ?? null,
                resolvedTeamId: null,
              },
              true,
            );
          }
        }
        return item;
      };
      const newSlot = async (name: string): Promise<string> => {
        const slot: TeamSlot = {
          ...(await db.stamp()),
          tournamentId,
          stageId: stage.id,
          groupName: null,
          slotName: name,
          teamId: null,
          seed: null,
        };
        await db.save('tournament_team_slots', slot, true);
        return slot.id;
      };
      const series = async (
        home: Entrant | null,
        away: Entrant | null,
      ): Promise<{
        winner: Entrant | null;
        loser: Entrant | null;
        last?: string;
      }> => {
        if (!home || !away) return { winner: home ?? away, loser: null };
        const ids: string[] = [];
        const legs = settings.legsPerRound ?? 1;
        for (let leg = 0; leg < legs; leg++) {
          const m = await make(
            leg % 2 ? away : home,
            leg % 2 ? home : away,
            ++nextRound,
          );
          ids.push(m.id);
        }
        const last = ids[ids.length - 1];
        generated.series[last] = ids;
        return {
          winner: {
            slotId: await newSlot(`Победитель ${last}`),
            source: { sourceType: 'WINNER', sourceMatchId: last },
          },
          loser: {
            slotId: await newSlot(`Проигравший ${last}`),
            source: { sourceType: 'LOSER', sourceMatchId: last },
          },
          last,
        };
      };
      const entrants: Entrant[] = slots.map((s) => ({ slotId: s.id }));
      for (const rule of settings.qualification ?? []) {
        const at = slots.findIndex((s) => s.slotName === rule.slotName);
        if (at < 0 || entrants[at].source)
          throw new BadRequestException('Некорректное правило qualification');
        if (slots[at].teamId)
          throw new ConflictException(
            'Слот с правилом qualification уже занят',
          );
        entrants[at].source = rule;
      }
      if (stage.format === 'ROUND_ROBIN') {
        for (const p of await BergerAlgorithm.generate(
          slots.map((s) => s.id),
          settings.rounds ?? 1,
        ))
          await make(
            entrants.find((e) => e.slotId === p.homeSlotId)!,
            entrants.find((e) => e.slotId === p.awaySlotId)!,
            p.round,
          );
      } else {
        if (
          stage.format === 'DOUBLE_ELIM' &&
          settings.dropToLowerBracket === false
        )
          throw new BadRequestException('DOUBLE_ELIM требует нижнюю сетку');
        const size = 2 ** Math.ceil(Math.log2(entrants.length));
        let seedOrder = [1, 2];
        while (seedOrder.length < size) {
          const sum = seedOrder.length * 2 + 1;
          seedOrder = seedOrder.flatMap((n) => [n, sum - n]);
        }
        let upper: (Entrant | null)[] = seedOrder.map(
            (n) => entrants[n - 1] ?? null,
          ),
          lower: (Entrant | null)[] = [];
        let round = 0;
        while (upper.length > 1) {
          const winners: (Entrant | null)[] = [],
            losers: (Entrant | null)[] = [];
          for (let i = 0; i < upper.length; i += 2) {
            const result = await series(upper[i], upper[i + 1]);
            winners.push(result.winner);
            losers.push(result.loser);
          }
          upper = winners;
          round++;
          if (stage.format === 'DOUBLE_ELIM') {
            if (round === 1) lower = losers;
            else {
              const incoming = [...losers].reverse(),
                next: (Entrant | null)[] = [];
              for (let i = 0; i < incoming.length; i++)
                next.push((await series(lower[i] ?? null, incoming[i])).winner);
              lower = next;
            }
            if (upper.length > 1) {
              const next: (Entrant | null)[] = [];
              for (let i = 0; i < lower.length; i += 2)
                next.push(
                  (await series(lower[i], lower[i + 1] ?? null)).winner,
                );
              lower = next;
            }
          }
        }
        if (stage.format === 'DOUBLE_ELIM') {
          const final = await series(upper[0], lower[0]);
          if (
            (settings.grandFinalReset ?? true) &&
            final.last &&
            final.winner &&
            final.loser &&
            upper[0]
          ) {
            const reset = await series(final.winner, final.loser);
            generated.reset = {
              finalId: final.last,
              resetId: reset.last!,
              upperSlotId: upper[0].slotId,
            };
          }
        }
      }
      // Validate generated dependency edges after all matches of this stage exist.
      for (const match of made)
        for (const rule of await db.list('bracket_slots', {
          matchId: match.id,
        }))
          await this.integrity.bracket(db, rule);
      await db.save('stages', {
        ...stage,
        settings: { ...settings, generated },
        updatedAt: new Date().toISOString(),
      });
      all.push(...made);
    }
    return all;
  }
}
