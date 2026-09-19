import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { CreateTournamentDto } from './dto/create-tournament.dto.js';
import type { TournamentFilterDto } from './dto/tournament-filter.dto.js';
import type { UpdateTournamentDto } from './dto/update-tournament.dto.js';
import type { Tournament } from './entities/types/schedule.types.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import { ScheduleRepository } from './repository/schedule.repository.js';

@Injectable()
export class ScheduleTournamentService {
  constructor(private readonly repository: ScheduleRepository) {}
  async create(data: CreateTournamentDto): Promise<Tournament> {
    return this.repository.transaction(async (db) => {
      if (data.startDate > data.endDate)
        throw new BadRequestException('Дата окончания раньше начала');
      if (data.templateId)
        await db.get('tournament_templates', data.templateId);
      return db.save(
        'tournaments',
        { ...(await db.stamp()), ...data, templateId: data.templateId ?? null },
        true,
      );
    });
  }
  async findAll(filter: TournamentFilterDto = {}): Promise<Tournament[]> {
    return this.repository.read(async (db) =>
      (await db.list('tournaments')).filter(
        (t) =>
          (!filter.season || t.season === filter.season) &&
          (!filter.type || t.type === filter.type) &&
          (!filter.dateFrom || t.endDate >= filter.dateFrom) &&
          (!filter.dateTo || t.startDate <= filter.dateTo),
      ),
    );
  }
  async findById(id: string | number): Promise<Tournament> {
    const key = await ScheduleMapper.id(id);
    return this.repository.read((db) => db.get('tournaments', key));
  }
  async isExistOrFail(id: string | number): Promise<void> {
    await this.findById(id);
  }
  async update(
    id: string | number,
    data: UpdateTournamentDto,
  ): Promise<Tournament> {
    const key = await ScheduleMapper.id(id);
    return this.repository.transaction(async (db) => {
      const item = {
        ...(await db.get('tournaments', key)),
        ...data,
        updatedAt: new Date().toISOString(),
      };
      if (item.startDate > item.endDate)
        throw new BadRequestException('Дата окончания раньше начала');
      if (item.templateId)
        await db.get('tournament_templates', item.templateId);
      if (
        (await db.list('matches', { tournamentId: key })).some(
          (m) =>
            m.matchDate.slice(0, 10) < item.startDate ||
            m.matchDate.slice(0, 10) > item.endDate,
        )
      )
        throw new ConflictException('Новые даты исключают существующие матчи');
      return db.save('tournaments', item);
    });
  }
  async remove(id: string | number): Promise<void> {
    const key = await ScheduleMapper.id(id);
    await this.repository.transaction(async (db) => {
      await db.get('tournaments', key);
      // Preserve externally referenced/assigned matches: deletion requires an empty tournament.
      if ((await db.list('matches', { tournamentId: key })).length)
        throw new ConflictException('Сначала удалите матчи турнира');
      const stages = await db.list('stages', { tournamentId: key });
      for (const rule of await db.list('bracket_slots'))
        if (stages.some((s) => s.id === rule.sourceStageId))
          throw new ConflictException('На этапы ссылается сетка');
      for (const slot of await db.list('tournament_team_slots', {
        tournamentId: key,
      }))
        await db.remove('tournament_team_slots', slot.id);
      for (const stage of stages) await db.remove('stages', stage.id);
      await db.remove('tournaments', key);
    });
  }
}
