import { ConflictException, Injectable } from '@nestjs/common';
import type { CreateTeamSlotDto } from './dto/create-team-slot.dto.js';
import type { TeamSlot } from './entities/types/schedule.types.js';
import { ScheduleRepository } from './repository/schedule.repository.js';

import { ScheduleIntegrityService } from './schedule-integrity.service.js';

@Injectable()
export class TeamSlotService {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly integrity: ScheduleIntegrityService,
  ) {}
  async create(
    tournamentId: string,
    data: CreateTeamSlotDto,
  ): Promise<TeamSlot> {
    return this.repository.transaction(async (db) => {
      const stage = await this.integrity.owned(
        db,
        'stages',
        data.stageId,
        tournamentId,
      );
      if ((await db.list('stages', { parentStageId: stage.id })).length)
        throw new ConflictException('Слоты разрешены только конечным этапам');
      if (stage.settings?.generated)
        throw new ConflictException('Нельзя добавлять слоты после генерации');
      if (data.teamId) await this.integrity.external('team', data.teamId);
      const slots = await db.list('tournament_team_slots', {
        stageId: stage.id,
      });
      if (
        slots.some(
          (s) =>
            s.slotName === data.slotName ||
            (data.teamId && s.teamId === data.teamId),
        )
      )
        throw new ConflictException('Имя слота или команда уже используются');
      return db.save(
        'tournament_team_slots',
        {
          ...(await db.stamp()),
          ...data,
          tournamentId,
          groupName: data.groupName ?? null,
          teamId: data.teamId ?? null,
          seed: data.seed ?? null,
        },
        true,
      );
    });
  }
  async findAll(tournamentId: string): Promise<TeamSlot[]> {
    return this.repository.read(async (db) => {
      await db.get('tournaments', tournamentId);
      return db.list('tournament_team_slots', { tournamentId });
    });
  }
  async assign(id: string, teamId: string): Promise<TeamSlot> {
    await this.integrity.external('team', teamId);
    return this.repository.transaction(async (db) => {
      const slot = await db.get('tournament_team_slots', id),
        matches = await db.list('matches', { tournamentId: slot.tournamentId });
      const affected = matches.filter(
        (m) => m.homeSlotId === id || m.awaySlotId === id,
      );
      if (
        (await db.list('bracket_slots')).some((b) =>
          affected.some(
            (m) =>
              m.id === b.matchId &&
              (b.side === 'HOME' ? m.homeSlotId : m.awaySlotId) === id,
          ),
        )
      )
        throw new ConflictException(
          'Для зависимого слота используйте переопределение bracket-slot',
        );
      if (affected.some((m) => m.homeScore !== null))
        throw new ConflictException('Нельзя менять команду сыгранного матча');
      if (
        (
          await db.list('tournament_team_slots', { stageId: slot.stageId })
        ).some((s) => s.id !== id && s.teamId === teamId)
      )
        throw new ConflictException('Команда уже занимает слот этапа');
      for (const m of affected) {
        if (m.homeSlotId === id) m.homeTeamId = teamId;
        if (m.awaySlotId === id) m.awayTeamId = teamId;
        if (m.homeTeamId === m.awayTeamId)
          throw new ConflictException('Матч против себя');
        await db.save('matches', { ...m, updatedAt: new Date().toISOString() });
      }
      return db.save('tournament_team_slots', {
        ...slot,
        teamId,
        updatedAt: new Date().toISOString(),
      });
    });
  }
  async remove(id: string): Promise<void> {
    await this.repository.transaction(async (db) => {
      const slot = await db.get('tournament_team_slots', id);
      if (
        (await db.list('matches', { tournamentId: slot.tournamentId })).some(
          (m) => m.homeSlotId === id || m.awaySlotId === id,
        )
      )
        throw new ConflictException('Слот используется в матчах');
      await db.remove('tournament_team_slots', id);
    });
  }
}
