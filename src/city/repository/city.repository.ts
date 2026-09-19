import { DbUniqueViolationException } from '../../common/exceptions/db-unique-violation.exception.js';
import { DbForeignKeyViolationException } from '../../common/exceptions/db-foreign-key-violation.exception.js';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ScheduleRepository } from '../../schedule/repository/schedule.repository.js';
import type { City } from '../entities/types/city.types.js';
@Injectable()
export class CityRepository {
  constructor(private readonly repository: ScheduleRepository) {}
  async findAll(): Promise<City[]> {
    return this.repository.read((db) => db.list('cities'));
  }
  async findById(id: string): Promise<City> {
    return this.repository.read((db) => db.get('cities', String(id)));
  }
  async save(name: string, id?: string): Promise<City> {
    return this.repository.transaction(async (db) => {
      const old = id === undefined ? null : await db.get('cities', String(id));
      if (
        (await db.list('cities')).some(
          (c) =>
            c.id !== old?.id &&
            c.name.toLocaleLowerCase('ru') === name.toLocaleLowerCase('ru'),
        )
      )
        throw new DbUniqueViolationException(
          [{ dbField: 'name', value: name }],
          'uq_cities_name',
        );
      const entity = {
        ...(old ?? (await db.stamp())),
        id: old?.id ?? randomUUID(),
        name,
        updatedAt: new Date().toISOString(),
      };
      return db.save('cities', entity, !old);
    });
  }
  async delete(id: string): Promise<void> {
    await this.repository.transaction(async (db) => {
      const key = String(id);
      await db.get('cities', key);
      if (
        (await db.list('teams', { cityId: key })).length ||
        (await db.list('matches', { cityId: key })).length ||
        (await db.list('tournament_templates')).some(
          (t) => t.schema.cityId === key,
        )
      )
        throw new DbForeignKeyViolationException(
          [{ dbField: 'id', value: key }],
          'fk_city_references',
        );
      await db.remove('cities', key);
    });
  }
}
