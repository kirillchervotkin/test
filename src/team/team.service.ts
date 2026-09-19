import { Injectable, Logger } from '@nestjs/common';
import type { CreateTeamDto } from './dto/createTeam.dto.js';
import type { UpdateTeamDto } from './dto/updateTeam.dto.js';
import type { TeamResponseDto } from './dto/teamResponse.dto.js';
import type { TeamService } from './interfaces/teamService.interface.js';
import { TeamRepository } from './repository/team.repository.js';
import { TeamMapper } from './mappers/team.mapper.js';
import { ReferenceValidation as V } from '../common/references/reference-validation.js';
@Injectable()
export class YdbTeamService implements TeamService {
  private readonly logger = new Logger(YdbTeamService.name);
  constructor(private readonly repository: TeamRepository) {}
  async create(data: CreateTeamDto): Promise<TeamResponseDto> {
    const name = await V.name(data.name);
    const result = await TeamMapper.toDto(
      await this.repository.save({ name, cityId: await V.id(data.cityId) }),
    );
    this.logger.log(`Создана команда ${result.id}`);
    return result;
  }
  async findAll(): Promise<TeamResponseDto[]> {
    const rows = await this.repository.findAll();
    rows.sort(
      (a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id),
    );
    return Promise.all(rows.map((row) => TeamMapper.toDto(row)));
  }
  async findOne(id: string): Promise<TeamResponseDto> {
    return TeamMapper.toDto(await this.repository.findById(await V.id(id)));
  }
  async update(id: string, data: UpdateTeamDto): Promise<TeamResponseDto> {
    await V.id(id);
    const fields: { name?: string; cityId?: string } = {};
    if (data.name !== undefined) fields.name = await V.name(data.name);
    if (data.cityId !== undefined) fields.cityId = await V.id(data.cityId);
    const result = await TeamMapper.toDto(
      await this.repository.save(fields, id),
    );
    this.logger.log(`Обновлена запись ${id}`);
    return result;
  }
  async remove(id: string): Promise<void> {
    await this.repository.delete(await V.id(id));
    this.logger.log(`Удалена запись ${id}`);
  }
}
