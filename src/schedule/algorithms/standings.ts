import { BadRequestException } from '@nestjs/common';
import type {
  Match,
  Settings,
  Standing,
  TeamSlot,
} from '../entities/types/schedule.types.js';
export class StandingsAlgorithm {
  static async calculate(
    slots: TeamSlot[],
    matches: Match[],
    settings: Settings,
  ): Promise<Standing[]> {
    const rows = new Map<string, Standing>();
    for (const slot of slots)
      if (slot.teamId)
        rows.set(slot.teamId, {
          teamId: slot.teamId,
          position: 0,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          tied: false,
        });
    const played = matches.filter(
      (m) => m.homeScore !== null && m.awayScore !== null,
    );
    for (const match of played) {
      if (
        !match.homeTeamId ||
        !match.awayTeamId ||
        match.homeTeamId === match.awayTeamId
      )
        throw new BadRequestException(
          'У сыгранного матча должны быть две разные команды',
        );
      const home = rows.get(match.homeTeamId),
        away = rows.get(match.awayTeamId);
      if (!home || !away)
        throw new BadRequestException(
          'Команда матча отсутствует в слотах этапа',
        );
      const h = match.homeScore!,
        a = match.awayScore!;
      home.played++;
      away.played++;
      home.goalsFor += h;
      home.goalsAgainst += a;
      away.goalsFor += a;
      away.goalsAgainst += h;
      if (h === a) {
        home.draws++;
        away.draws++;
        home.points += settings.pointsForDraw ?? 1;
        away.points += settings.pointsForDraw ?? 1;
      } else {
        const win = h > a ? home : away,
          loss = h > a ? away : home;
        win.wins++;
        loss.losses++;
        win.points += settings.pointsForWin ?? 3;
        loss.points += settings.pointsForLoss ?? 0;
      }
    }
    const values = [...rows.values()];
    for (const row of values)
      row.goalDifference = row.goalsFor - row.goalsAgainst;
    const mini = new Map<string, number[]>();
    for (const row of values) {
      const peers = new Set(
        values.filter((v) => v.points === row.points).map((v) => v.teamId),
      );
      let pts = 0,
        gd = 0,
        gf = 0;
      for (const m of played) {
        if (!peers.has(m.homeTeamId!) || !peers.has(m.awayTeamId!)) continue;
        if (m.homeTeamId !== row.teamId && m.awayTeamId !== row.teamId)
          continue;
        const h = m.homeTeamId === row.teamId ? m.homeScore! : m.awayScore!,
          a = m.homeTeamId === row.teamId ? m.awayScore! : m.homeScore!;
        pts +=
          h === a
            ? (settings.pointsForDraw ?? 1)
            : h > a
              ? (settings.pointsForWin ?? 3)
              : (settings.pointsForLoss ?? 0);
        gd += h - a;
        gf += h;
      }
      mini.set(row.teamId, [pts, gd, gf]);
    }
    const keys = settings.tieBreakers ?? ['goalDifference', 'goalsScored'];
    const vector = (r: Standing) => [
      r.points,
      ...keys.flatMap((k) =>
        k === 'headToHead'
          ? mini.get(r.teamId)!
          : [
              k === 'goalDifference'
                ? r.goalDifference
                : k === 'goalsScored'
                  ? r.goalsFor
                  : r.wins,
            ],
      ),
    ];
    const compare = (a: Standing, b: Standing) => {
      const av = vector(a),
        bv = vector(b);
      for (let i = 0; i < av.length; i++)
        if (av[i] !== bv[i]) return bv[i] - av[i];
      return 0;
    };
    values.sort((a, b) => compare(a, b) || a.teamId.localeCompare(b.teamId));
    for (let i = 0; i < values.length; i++) {
      const prev = i > 0 && compare(values[i - 1], values[i]) === 0,
        next = i + 1 < values.length && compare(values[i], values[i + 1]) === 0;
      values[i].position = prev ? values[i - 1].position : i + 1;
      values[i].tied = prev || next;
    }
    return values;
  }
}
