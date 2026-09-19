import { ConflictException, Injectable } from '@nestjs/common';
import { ScheduleSettings } from './algorithms/settings.js';
import type { CreateTemplateDto } from './dto/create-template.dto.js';
import type { UpdateTemplateDto } from './dto/update-template.dto.js';
import type { Template } from './entities/types/schedule.types.js';
import { ScheduleRepository } from './repository/schedule.repository.js';

@Injectable()
export class TemplateService {
  constructor(private readonly repository: ScheduleRepository) {}
  async create(data: CreateTemplateDto): Promise<Template> {
    const schema = await ScheduleSettings.template(data.schema);
    return this.repository.transaction(async (db) =>
      db.save(
        'tournament_templates',
        {
          ...(await db.stamp()),
          ...data,
          schema,
          description: data.description ?? null,
        },
        true,
      ),
    );
  }
  async findAll(): Promise<Template[]> {
    return this.repository.read((db) => db.list('tournament_templates'));
  }
  async findOne(id: string): Promise<Template> {
    return this.repository.read((db) => db.get('tournament_templates', id));
  }
  async update(id: string, data: UpdateTemplateDto): Promise<Template> {
    return this.repository.transaction(async (db) => {
      const old = await db.get('tournament_templates', id);
      const schema = data.schema
        ? await ScheduleSettings.template(data.schema)
        : old.schema;
      if (
        data.schema &&
        data.version !== undefined &&
        data.version <= old.version
      )
        throw new ConflictException('Версия новой схемы должна увеличиваться');
      return db.save('tournament_templates', {
        ...old,
        ...data,
        schema,
        version: data.schema
          ? (data.version ?? old.version + 1)
          : (data.version ?? old.version),
        updatedAt: new Date().toISOString(),
      });
    });
  }
  async remove(id: string): Promise<void> {
    await this.repository.transaction(async (db) => {
      await db.get('tournament_templates', id);
      if ((await db.list('tournaments', { templateId: id })).length)
        throw new ConflictException(
          'Шаблон используется турнирами; отключите isActive',
        );
      await db.remove('tournament_templates', id);
    });
  }
}
