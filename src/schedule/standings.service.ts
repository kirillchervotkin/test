import { BadRequestException, Injectable } from '@nestjs/common';
import { StandingsAlgorithm } from './algorithms/standings.js';
import type { Standing } from './entities/types/schedule.types.js';
import type { ScheduleStore } from './repository/schedule.repository.js';
import { ScheduleRepository } from './repository/schedule.repository.js';

@Injectable()
export class StandingsService {
  constructor(private readonly repository: ScheduleRepository) {}
  async calculate(stageId: string): Promise<Standing[]> {
    return this.repository.read((db) => this.calculateIn(db, stageId));
  }
  async calculateIn(db: ScheduleStore, stageId: string): Promise<Standing[]> {
    const stage = await db.get('stages', stageId);
    if (stage.format !== 'ROUND_ROBIN')
      throw new BadRequestException('Таблица доступна для кругового этапа');
    return StandingsAlgorithm.calculate(
      await db.list('tournament_team_slots', { stageId }),
      await db.list('matches', { stageId }),
      stage.settings ?? {},
    );
  }
}
