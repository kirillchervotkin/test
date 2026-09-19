import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateMatchDto } from './dto/create-match.dto.js';
import type { UpdateMatchDto } from './dto/update-match.dto.js';
import type { Match } from './entities/types/schedule.types.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import { ScheduleRepository } from './repository/schedule.repository.js';

import { ScheduleIntegrityService } from './schedule-integrity.service.js';

@Injectable()
export class ScheduleMatchService {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly integrity: ScheduleIntegrityService,
  ) {}
  async create(
    tournamentId: string | number,
    data: CreateMatchDto,
    groupId?: string | number,
  ): Promise<Match> {
    const tid = await ScheduleMapper.id(tournamentId);
    return this.repository.transaction(async (db) => {
      const item: Match = {
        ...(await db.stamp()),
        ...data,
        tournamentId: tid,
        stageId: groupId
          ? await ScheduleMapper.id(groupId)
          : (data.stageId ?? null),
        homeSlotId: data.homeSlotId ?? null,
        awaySlotId: data.awaySlotId ?? null,
        homeTeamId: data.homeTeamId ?? null,
        awayTeamId: data.awayTeamId ?? null,
        homeScore: data.homeScore ?? null,
        awayScore: data.awayScore ?? null,
      };
      await this.integrity.match(db, item);
      return db.save('matches', item, true);
    });
  }
  async findOne(id: string | number): Promise<Match> {
    const key = await ScheduleMapper.id(id);
    return this.repository.read((db) => db.get('matches', key));
  }
  async findAllByTournament(tournamentId: string | number): Promise<Match[]> {
    const key = await ScheduleMapper.id(tournamentId);
    return this.repository.read(async (db) => {
      await db.get('tournaments', key);
      return db.list('matches', { tournamentId: key });
    });
  }
  async findAllByGroup(
    tournamentId: string | number,
    groupId: string | number,
  ): Promise<Match[]> {
    const tid = await ScheduleMapper.id(tournamentId),
      sid = await ScheduleMapper.id(groupId);
    return this.repository.read(async (db) => {
      await this.integrity.owned(db, 'stages', sid, tid);
      return db.list('matches', { stageId: sid });
    });
  }
  async update(id: string | number, data: UpdateMatchDto): Promise<Match> {
    const key = await ScheduleMapper.id(id);
    return this.repository.transaction(async (db) => {
      const old = await db.get('matches', key),
        item = { ...old, ...data, updatedAt: new Date().toISOString() };
      const stage = old.stageId ? await db.get('stages', old.stageId) : null;
      const sourceIds = new Set([
        key,
        ...Object.entries(stage?.settings?.generated?.series ?? {})
          .filter(([, ids]) => ids.includes(key))
          .map(([anchor]) => anchor),
      ]);
      if (
        (await db.list('bracket_slots')).some(
          (b) =>
            b.resolvedTeamId &&
            ((b.sourceMatchId && sourceIds.has(b.sourceMatchId)) ||
              (b.sourceType === 'GROUP' &&
                stage &&
                (b.sourceStageId === stage.id ||
                  b.sourceStageId === stage.parentStageId))),
        )
      )
        throw new ConflictException(
          'Результат уже использован в следующем этапе',
        );
      if (
        old.stageId &&
        (await db.get('stages', old.stageId)).settings?.generated &&
        [
          'stageId',
          'homeSlotId',
          'awaySlotId',
          'homeTeamId',
          'awayTeamId',
        ].some((k) => k in data)
      )
        throw new ConflictException(
          'Участников сгенерированного матча меняют через слоты',
        );
      await this.integrity.match(db, item);
      return db.save('matches', item);
    });
  }
  async remove(id: string | number): Promise<{ message: string }> {
    const key = await ScheduleMapper.id(id);
    return this.repository.transaction(async (db) => {
      const match = await db.get('matches', key);
      if (
        match.stageId &&
        (await db.get('stages', match.stageId)).settings?.generated
      )
        throw new ConflictException(
          'Нельзя удалять отдельный матч сгенерированного этапа',
        );
      if ((await db.list('bracket_slots')).some((b) => b.sourceMatchId === key))
        throw new ConflictException('Матч используется сеткой');
      for (const b of await db.list('bracket_slots', { matchId: key }))
        await db.remove('bracket_slots', b.id);
      await db.remove('matches', key);
      return { message: 'Матч удалён' };
    });
  }
  async removeFromGroup(
    t: string | number,
    g: string | number,
    id: string | number,
  ): Promise<{ message: string }> {
    const m = await this.findOne(id);
    if (m.tournamentId !== String(t) || m.stageId !== String(g))
      throw new NotFoundException('Матч не найден в группе');
    return this.remove(id);
  }
  async removeFromTournament(
    t: string | number,
    id: string | number,
  ): Promise<{ message: string }> {
    const m = await this.findOne(id);
    if (m.tournamentId !== String(t))
      throw new NotFoundException('Матч не найден в турнире');
    return this.remove(id);
  }
}
