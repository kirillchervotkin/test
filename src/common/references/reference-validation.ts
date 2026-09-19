import type { ScheduleStore } from '../../schedule/repository/schedule.repository.js';
import type { TemplateSchema } from '../../schedule/entities/types/schedule.types.js';
import { isUUID } from 'class-validator';
import { DbForeignKeyViolationException } from '../exceptions/db-foreign-key-violation.exception.js';
import { BadRequestException } from '@nestjs/common';
import type { TemplateStage } from '../../schedule/entities/types/schedule.types.js';
export class ReferenceValidation {
  static async template(
    db: ScheduleStore,
    schema: TemplateSchema,
  ): Promise<void> {
    await this.exists(db, 'cities', schema.cityId, 'schema');
    const visit = async (stages: TemplateStage[]): Promise<void> => {
      for (const stage of stages) {
        for (const slot of stage.slots ?? [])
          if (slot.teamId)
            await this.exists(db, 'teams', slot.teamId, 'schema');
        await visit(stage.children ?? []);
      }
    };
    await visit(schema.stages);
  }

  static async id(id: string): Promise<string> {
    if (typeof id !== 'string' || !isUUID(id, '4'))
      throw new BadRequestException('Идентификатор должен быть UUID v4');
    return Promise.resolve(id.toLowerCase());
  }
  static async exists(
    db: ScheduleStore,
    table: 'cities' | 'teams',
    id: string,
    field: string,
  ): Promise<void> {
    const key = await this.id(id);
    if (!(await db.list(table, { id: key })).length)
      throw new DbForeignKeyViolationException(
        [{ dbField: field, value: key }],
        `fk_${field}`,
      );
  }
  static async name(value: string): Promise<string> {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > 100)
      throw new BadRequestException(
        'Название должно содержать от 1 до 100 символов',
      );
    return Promise.resolve(value.trim().normalize('NFC'));
  }
  static async templateHasTeam(
    stages: TemplateStage[],
    id: string,
  ): Promise<boolean> {
    for (const stage of stages) {
      if (stage.slots?.some((slot) => slot.teamId === id)) return true;
      if (await this.templateHasTeam(stage.children ?? [], id)) return true;
    }
    return false;
  }
}
