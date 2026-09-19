import { Injectable } from '@nestjs/common';
import type { Calendar } from './entities/types/schedule.types.js';
import { ScheduleRepository } from './repository/schedule.repository.js';

@Injectable()
export class CalendarService {
  constructor(private readonly repository: ScheduleRepository) {}
  async calendar(tournamentId: string): Promise<Calendar> {
    return this.repository.read(async (db) => {
      const tournament = await db.get('tournaments', tournamentId),
        stages = await db.list('stages', { tournamentId }),
        slots = await db.list('tournament_team_slots', { tournamentId }),
        matches = await db.list('matches', { tournamentId });
      const ids = new Set(matches.map((m) => m.id));
      return {
        tournament,
        stages,
        slots,
        matches: matches.sort((a, b) => a.matchDate.localeCompare(b.matchDate)),
        bracketSlots: (await db.list('bracket_slots')).filter((b) =>
          ids.has(b.matchId),
        ),
      };
    });
  }
}
