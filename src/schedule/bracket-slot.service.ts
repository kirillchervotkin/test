import { ConflictException, Injectable } from '@nestjs/common';
import type { CreateBracketSlotDto } from './dto/create-bracket-slot.dto.js';
import type { BracketSlot } from './entities/types/schedule.types.js';
import { ScheduleRepository } from './repository/schedule.repository.js';
import { ScheduleIntegrityService } from './schedule-crud.service.js';

import { BracketResolverService } from './bracket-resolver-core.service.js';

@Injectable()
export class BracketSlotService {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly integrity: ScheduleIntegrityService,
    private readonly resolver: BracketResolverService,
  ) {}
  async create(data: CreateBracketSlotDto): Promise<BracketSlot> {
    return this.repository.transaction(async (db) => {
      const rule: BracketSlot = {
        ...(await db.stamp()),
        ...data,
        sourceStageId: data.sourceStageId ?? null,
        sourceGroupName: data.sourceGroupName ?? null,
        sourcePosition: data.sourcePosition ?? null,
        sourceMatchId: data.sourceMatchId ?? null,
        resolvedTeamId: null,
      };
      await this.integrity.bracket(db, rule);
      return db.save('bracket_slots', rule, true);
    });
  }
  async findAll(stageId: string): Promise<BracketSlot[]> {
    return this.repository.read(async (db) => {
      await db.get('stages', stageId);
      const matches = new Set(
        (await db.list('matches', { stageId })).map((m) => m.id),
      );
      return (await db.list('bracket_slots')).filter((b) =>
        matches.has(b.matchId),
      );
    });
  }
  async override(id: string, teamId: string): Promise<BracketSlot> {
    await this.integrity.external('team', teamId);
    return this.repository.transaction(async (db) => {
      const rule = await db.get('bracket_slots', id);
      if (rule.resolvedTeamId && rule.resolvedTeamId !== teamId)
        throw new ConflictException(
          'Слот уже разрешён; изменение требует отката зависимых результатов',
        );
      return this.resolver.apply(db, rule, teamId);
    });
  }
  async remove(id: string): Promise<void> {
    await this.repository.transaction(async (db) => {
      const rule = await db.get('bracket_slots', id);
      if (rule.resolvedTeamId) throw new ConflictException('Слот уже разрешён');
      await db.remove('bracket_slots', id);
    });
  }
}
