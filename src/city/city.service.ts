import { Injectable, Logger } from '@nestjs/common';
import type { CreateCityDto } from './dto/createCity.dto.js';
import type { UpdateCityDto } from './dto/updateCity.dto.js';
import type { CityResponseDto } from './dto/cityResponse.dto.js';
import type { CityService } from './interfaces/cityService.interface.js';
import { CityRepository } from './repository/city.repository.js';
import { CityMapper } from './mappers/city.mapper.js';
import { ReferenceValidation as V } from '../common/references/reference-validation.js';
@Injectable()
export class YdbCityService implements CityService {
  private readonly logger = new Logger(YdbCityService.name);
  constructor(private readonly repository: CityRepository) {}
  async create(data: CreateCityDto): Promise<CityResponseDto> {
    const name = await V.name(data.name);
    const result = await CityMapper.toDto(await this.repository.save(name));
    this.logger.log(`Создан город ${result.id}`);
    return result;
  }
  async findAll(): Promise<CityResponseDto[]> {
    const rows = await this.repository.findAll();
    rows.sort(
      (a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id),
    );
    return Promise.all(rows.map((row) => CityMapper.toDto(row)));
  }
  async findOne(id: string): Promise<CityResponseDto> {
    return CityMapper.toDto(await this.repository.findById(await V.id(id)));
  }
  async update(id: string, data: UpdateCityDto): Promise<CityResponseDto> {
    await V.id(id);
    if (data.name === undefined) return this.findOne(id);
    const result = await CityMapper.toDto(
      await this.repository.save(await V.name(data.name), id),
    );
    this.logger.log(`Обновлена запись ${id}`);
    return result;
  }
  async remove(id: string): Promise<void> {
    await this.repository.delete(await V.id(id));
    this.logger.log(`Удалена запись ${id}`);
  }
  async searchByName(name: string): Promise<CityResponseDto[]> {
    const needle = name.trim().toLocaleLowerCase('ru');
    return (await this.findAll()).filter((c) =>
      c.name.toLocaleLowerCase('ru').includes(needle),
    );
  }
}
