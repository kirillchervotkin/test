import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../../common/exceptions/db-foreign-key-violation.exception.js';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ScheduleRepository } from '../../schedule/repository/schedule.repository.js';
import { ReferenceValidation } from '../../common/references/reference-validation.js';
import type { Team } from '../entities/types/team.types.js';
@Injectable()
export class TeamRepository {
  constructor(private readonly repository: ScheduleRepository) {}
  async findAll(): Promise<Team[]> {
    return this.repository.read((db) => db.list('teams'));
  }
  async findById(id: string): Promise<Team> {
    return this.repository.read((db) => db.get('teams', String(id)));
  }
  async save(
    fields: { name?: string; cityId?: string },
    id?: string,
  ): Promise<Team> {
    return this.repository.transaction(async (db) => {
      const old = id === undefined ? null : await db.get('teams', String(id));
      const name = fields.name ?? old!.name,
        cityId =
          fields.cityId === undefined ? old!.cityId : String(fields.cityId);
      await ReferenceValidation.exists(db, 'cities', cityId, 'cityId');
      if (
        (await db.list('teams', { cityId })).some(
          (t) =>
            t.id !== old?.id &&
            t.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'),
        )
      )
        throw new DbUniqueViolationException(
          [
            { dbField: 'name', value: name },
            { dbField: 'cityId', value: cityId },
          ],
          'uq_teams_city_name',
        );
      const entity = {
        ...(old ?? (await db.stamp())),
        id: old?.id ?? randomUUID(),
        name,
        cityId,
        updatedAt: new Date().toISOString(),
      };
      return db.save('teams', entity, !old);
    });
  }
  async delete(id: string): Promise<void> {
    await this.repository.transaction(async (db) => {
      const key = String(id);
      await db.get('teams', key);
      if (
        (await db.list('tournament_team_slots', { teamId: key })).length ||
        (await db.list('matches', { homeTeamId: key })).length ||
        (await db.list('matches', { awayTeamId: key })).length ||
        (await db.list('bracket_slots', { resolvedTeamId: key })).length
      )
        throw new DbForeignKeyViolationException(
          [{ dbField: 'id', value: key }],
          'fk_team_calendar',
        );
      for (const template of await db.list('tournament_templates'))
        if (
          await ReferenceValidation.templateHasTeam(template.schema.stages, key)
        )
          throw new DbForeignKeyViolationException(
            [{ dbField: 'id', value: key }],
            'fk_team_template',
          );
      await db.remove('teams', key);
    });
  }
}
