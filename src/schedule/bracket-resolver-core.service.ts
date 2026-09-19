import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { BracketSlot, Match } from './entities/types/schedule.types.js';
import type { ScheduleStore } from './repository/schedule.repository.js';
import { ScheduleRepository } from './repository/schedule.repository.js';

import { StandingsService } from './standings.service.js';

@Injectable()
export class BracketResolverService {
  private readonly logger = new Logger(BracketResolverService.name);
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly standings: StandingsService,
  ) {}
  async result(
    db: ScheduleStore,
    matchId: string,
  ): Promise<{ winner: string; loser: string } | null> {
    const last = await db.get('matches', matchId);
    if (!last.stageId) return null;
    const stage = await db.get('stages', last.stageId),
      ids = stage.settings?.generated?.series[matchId] ?? [matchId];
    const matches: Match[] = [];
    for (const id of ids) matches.push(await db.get('matches', id));
    if (
      matches.some(
        (m) =>
          m.homeScore === null ||
          m.awayScore === null ||
          !m.homeTeamId ||
          !m.awayTeamId,
      )
    )
      return null;
    const totals = new Map<string, number>();
    for (const m of matches) {
      totals.set(
        m.homeTeamId!,
        (totals.get(m.homeTeamId!) ?? 0) + m.homeScore!,
      );
      totals.set(
        m.awayTeamId!,
        (totals.get(m.awayTeamId!) ?? 0) + m.awayScore!,
      );
    }
    if (totals.size !== 2)
      throw new ConflictException('Состав команд в серии различается');
    const [a, b] = [...totals.keys()];
    let winner: string;
    if (totals.get(a) === totals.get(b)) {
      const decision = stage.settings?.decisions?.[matchId];
      if (!decision) return null;
      if (!totals.has(decision))
        throw new BadRequestException(
          'Победитель decisions не участвовал в серии',
        );
      winner = decision;
    } else winner = totals.get(a)! > totals.get(b)! ? a : b;
    return { winner, loser: winner === a ? b : a };
  }
  async source(db: ScheduleStore, rule: BracketSlot): Promise<string | null> {
    if (rule.sourceType !== 'GROUP') {
      const result = await this.result(db, rule.sourceMatchId!);
      return result
        ? rule.sourceType === 'WINNER'
          ? result.winner
          : result.loser
        : null;
    }
    let stageId = rule.sourceStageId!;
    if (rule.sourceGroupName) {
      const children = await db.list('stages', { parentStageId: stageId });
      const group = children.find((s) => s.name === rule.sourceGroupName);
      if (!group) return null;
      stageId = group.id;
    }
    const stage = await db.get('stages', stageId),
      matches = await db.list('matches', { stageId });
    if (
      !stage.settings?.generated ||
      !matches.length ||
      matches.some(
        (m) =>
          m.homeScore === null ||
          m.awayScore === null ||
          !m.homeTeamId ||
          !m.awayTeamId,
      )
    )
      return null;
    const table = await this.standings.calculateIn(db, stageId),
      row = table.find((r) => r.position === rule.sourcePosition);
    return row && !row.tied ? row.teamId : null;
  }
  async apply(
    db: ScheduleStore,
    rule: BracketSlot,
    teamId: string,
  ): Promise<BracketSlot> {
    const target = await db.get('matches', rule.matchId),
      slotId = rule.side === 'HOME' ? target.homeSlotId : target.awaySlotId;
    const affected = slotId
      ? (
          await db.list('matches', { tournamentId: target.tournamentId })
        ).filter((m) => m.homeSlotId === slotId || m.awaySlotId === slotId)
      : [target];
    for (const m of affected) {
      const home = slotId ? m.homeSlotId === slotId : rule.side === 'HOME';
      const away = slotId ? m.awaySlotId === slotId : rule.side === 'AWAY';
      const current = home ? m.homeTeamId : m.awayTeamId;
      if (m.homeScore !== null && current !== teamId)
        throw new ConflictException(
          'Нельзя изменять участников сыгранного матча',
        );
      if (home) m.homeTeamId = teamId;
      if (away) m.awayTeamId = teamId;
      if (m.homeTeamId === m.awayTeamId)
        throw new ConflictException('Слот создаёт матч против себя');
      await db.save('matches', { ...m, updatedAt: new Date().toISOString() });
      for (const sibling of await db.list('bracket_slots', { matchId: m.id }))
        if (
          (home && sibling.side === 'HOME') ||
          (away && sibling.side === 'AWAY')
        ) {
          if (sibling.resolvedTeamId && sibling.resolvedTeamId !== teamId)
            throw new ConflictException(
              'Ранее разрешённый слот противоречит новому результату',
            );
          await db.save('bracket_slots', {
            ...sibling,
            resolvedTeamId: teamId,
            updatedAt: new Date().toISOString(),
          });
        }
    }
    if (slotId)
      await db.save('tournament_team_slots', {
        ...(await db.get('tournament_team_slots', slotId)),
        teamId,
        updatedAt: new Date().toISOString(),
      });
    return db.save('bracket_slots', {
      ...rule,
      resolvedTeamId: teamId,
      updatedAt: new Date().toISOString(),
    });
  }
  async resolve(stageId: string): Promise<BracketSlot[]> {
    const result = await this.repository.transaction(async (db) => {
      const stage = await db.get('stages', stageId),
        matches = await db.list('matches', { stageId });
      const ids = new Set(matches.map((m) => m.id));
      const rules = (await db.list('bracket_slots')).filter((b) =>
        ids.has(b.matchId),
      );
      for (let pass = 0; pass <= rules.length; pass++) {
        let changed = false;
        for (const r of rules) {
          const rule = await db.get('bracket_slots', r.id);
          if (rule.resolvedTeamId) continue;
          const reset = stage.settings?.generated?.reset;
          if (
            reset &&
            (
              stage.settings?.generated?.series[reset.resetId] ?? [
                reset.resetId,
              ]
            ).includes(rule.matchId)
          ) {
            const final = await this.result(db, reset.finalId),
              upper = (await db.get('tournament_team_slots', reset.upperSlotId))
                .teamId;
            if (!final || !upper || final.winner === upper) continue;
          }
          const team = await this.source(db, rule);
          if (team) {
            await this.apply(db, rule, team);
            changed = true;
          }
        }
        if (!changed) break;
      }
      return (await db.list('bracket_slots')).filter((b) => ids.has(b.matchId));
    });
    this.logger.log(
      `Резолвер этапа ${stageId}: заполнено ${result.filter((r) => r.resolvedTeamId).length}/${result.length}`,
    );
    return result;
  }
}
