import { ConflictException, Injectable } from '@nestjs/common';
import { ScheduleSettings } from './algorithms/settings.js';
import type { CreateStageDto } from './dto/create-stage.dto.js';
import type { UpdateStageDto } from './dto/update-stage.dto.js';
import type { Stage, StageNode } from './entities/types/schedule.types.js';
import { ScheduleRepository } from './repository/schedule.repository.js';

import { ScheduleIntegrityService } from './schedule-integrity.service.js';

@Injectable()
export class StageService {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly integrity: ScheduleIntegrityService,
  ) {}
  async create(tournamentId: string, data: CreateStageDto): Promise<Stage> {
    return this.repository.transaction(async (db) => {
      await db.get('tournaments', tournamentId);
      if (data.parentStageId) {
        const parent = await this.integrity.owned(
          db,
          'stages',
          data.parentStageId,
          tournamentId,
        );
        if (
          parent.settings?.generated ||
          (await db.list('tournament_team_slots', { stageId: parent.id }))
            .length
        )
          throw new ConflictException('Родитель содержит календарь или слоты');
      }
      return db.save(
        'stages',
        {
          ...(await db.stamp()),
          ...data,
          tournamentId,
          parentStageId: data.parentStageId ?? null,
          settings: await ScheduleSettings.parse(data.settings),
        },
        true,
      );
    });
  }
  async findAll(tournamentId: string): Promise<Stage[]> {
    return this.repository.read(async (db) => {
      await db.get('tournaments', tournamentId);
      return (await db.list('stages', { tournamentId })).sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
    });
  }
  async findOne(id: string): Promise<Stage> {
    return this.repository.read((db) => db.get('stages', id));
  }
  async tree(tournamentId: string): Promise<StageNode[]> {
    const stages = await this.findAll(tournamentId);
    const nodes = new Map(
      stages.map((s) => [s.id, { ...s, children: [] } as StageNode]),
    );
    const roots: StageNode[] = [];
    for (const s of nodes.values()) {
      if (s.parentStageId) {
        const p = nodes.get(s.parentStageId);
        if (!p) throw new ConflictException('Нарушена иерархия этапов');
        p.children.push(s);
      } else roots.push(s);
    }
    return roots;
  }
  async update(id: string, data: UpdateStageDto): Promise<Stage> {
    return this.repository.transaction(async (db) => {
      const old = await db.get('stages', id),
        item = { ...old, ...data, updatedAt: new Date().toISOString() };
      const settings =
        data.settings === undefined
          ? old.settings
          : await ScheduleSettings.parse(data.settings);
      if (data.settings?.decisions) {
        const matches = new Set(
          (await db.list('matches', { stageId: id })).map((m) => m.id),
        );
        if (
          (await db.list('bracket_slots')).some(
            (b) =>
              b.sourceMatchId &&
              matches.has(b.sourceMatchId) &&
              b.resolvedTeamId,
          )
        )
          throw new ConflictException('Решения этапа уже использованы в сетке');
      }
      if (
        old.settings?.generated &&
        data.parentStageId !== undefined &&
        data.parentStageId !== old.parentStageId
      )
        throw new ConflictException('Нельзя переносить сгенерированный этап');
      if (old.settings?.generated) {
        const { decisions: _, generated: __, ...prior } = old.settings;
        const { decisions: ___, generated: ____, ...next } = settings ?? {};
        if (
          item.format !== old.format ||
          JSON.stringify(prior) !== JSON.stringify(next)
        )
          throw new ConflictException(
            'После генерации нельзя менять формат и правила; разрешены только decisions',
          );
        item.settings = { ...settings, generated: old.settings.generated };
      } else item.settings = settings;
      const seen = new Set([id]);
      let parent = item.parentStageId;
      while (parent) {
        if (seen.has(parent)) throw new ConflictException('Цикл этапов');
        seen.add(parent);
        parent = (
          await this.integrity.owned(db, 'stages', parent, old.tournamentId)
        ).parentStageId;
      }
      if (
        item.parentStageId &&
        (await db.list('matches', { stageId: item.parentStageId })).length
      )
        throw new ConflictException('Родитель уже содержит матчи');
      return db.save('stages', item);
    });
  }
  async remove(id: string): Promise<void> {
    await this.repository.transaction(async (db) => {
      await db.get('stages', id);
      if (
        (await db.list('stages', { parentStageId: id })).length ||
        (await db.list('matches', { stageId: id })).length ||
        (await db.list('tournament_team_slots', { stageId: id })).length ||
        (await db.list('bracket_slots', { sourceStageId: id })).length
      )
        throw new ConflictException(
          'Этап используется; сначала удалите дочерние объекты',
        );
      await db.remove('stages', id);
    });
  }
}
