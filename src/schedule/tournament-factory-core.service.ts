import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ScheduleSettings } from './algorithms/settings.js';
import type {
  Stage,
  TemplateStage,
  Tournament,
} from './entities/types/schedule.types.js';
import { ScheduleRepository } from './repository/schedule.repository.js';
import { ScheduleIntegrityService } from './schedule-crud.service.js';
import { ScheduleGeneratorService } from './schedule-generator.service.js';

@Injectable()
export class TournamentFactoryService {
  private readonly logger = new Logger(TournamentFactoryService.name);
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly generator: ScheduleGeneratorService,
    private readonly integrity: ScheduleIntegrityService,
  ) {}
  async createFromTemplate(
    templateId: string,
    season: string,
    startDate: string,
    endDate: string,
  ): Promise<Tournament> {
    if (startDate > endDate)
      throw new BadRequestException('Дата окончания раньше начала');
    const created = await this.repository.transaction(async (db) => {
      const template = await db.get('tournament_templates', templateId);
      if (!template.isActive) throw new ConflictException('Шаблон отключён');
      const schema = await ScheduleSettings.template(template.schema);
      const tournament: Tournament = {
        ...(await db.stamp()),
        name: schema.name,
        season,
        type: schema.type,
        startDate,
        endDate,
        templateId,
      };
      await db.save('tournaments', tournament, true);
      const keys = new Map<string, string>(),
        stages: Stage[] = [];
      const expand = async (
        nodes: TemplateStage[],
        parentStageId: string | null,
      ): Promise<void> => {
        for (let sortOrder = 0; sortOrder < nodes.length; sortOrder++) {
          const node = nodes[sortOrder];
          if (node.children?.length && node.slots?.length)
            throw new BadRequestException(
              'Слоты задаются только для конечных этапов',
            );
          const stage: Stage = {
            ...(await db.stamp()),
            tournamentId: tournament.id,
            parentStageId,
            type: node.type,
            format: node.format,
            name: node.name,
            sortOrder,
            settings: node.settings ?? {},
          };
          keys.set(node.key, stage.id);
          stages.push(stage);
          await db.save('stages', stage, true);
          const names = new Set<string>(),
            teams = new Set<string>();
          for (const slot of node.slots ?? []) {
            if (names.has(slot.name) || (slot.teamId && teams.has(slot.teamId)))
              throw new ConflictException(
                'Слот или команда повторяется в этапе',
              );
            names.add(slot.name);
            if (slot.teamId) {
              teams.add(slot.teamId);
              await this.integrity.external('team', slot.teamId);
            }
            await db.save(
              'tournament_team_slots',
              {
                ...(await db.stamp()),
                tournamentId: tournament.id,
                stageId: stage.id,
                groupName: node.type === 'GROUP' ? node.name : null,
                slotName: slot.name,
                teamId: slot.teamId ?? null,
                seed: slot.seed ?? null,
              },
              true,
            );
          }
          await expand(node.children ?? [], stage.id);
        }
      };
      await expand(schema.stages, null);
      for (const stage of stages) {
        for (const rule of stage.settings?.qualification ?? []) {
          if (rule.sourceStageKey) {
            const id = keys.get(rule.sourceStageKey);
            if (!id)
              throw new BadRequestException(
                'В qualification указан неизвестный sourceStageKey',
              );
            rule.sourceStageId = id;
            delete rule.sourceStageKey;
          }
        }
        await db.save('stages', stage);
      }
      // Match IDs must exist before bracket_slots can reference them. The generator
      // materializes the symbolic qualification rules after creating the matches.
      await this.generator.generateIn(db, tournament.id, {
        cityId: schema.cityId,
        intervalDays: schema.intervalDays,
      });
      return tournament;
    });
    this.logger.log(`Шаблон ${templateId} развёрнут в турнир ${created.id}`);
    return created;
  }
}
