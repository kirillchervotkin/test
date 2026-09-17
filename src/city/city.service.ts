import { Injectable } from '@nestjs/common';
import { CityResponseDto } from './dto/cityResponse.dto.js';
import { EntityNotFoundException } from '../common/exceptions/entityNotFound.exception.js';
import { CreateCityDto } from './dto/createCity.dto.js';
import { UpdateCityDto } from './dto/updateCity.dto.js';
import { CityService } from './interfaces/cityService.interface.js';

interface CityStub {
  id: number;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TypeOrmCityService implements CityService {
  private cities: CityStub[] = [];
  private nextId = 1;

  create(createCityDto: CreateCityDto): Promise<CityResponseDto> {
    const now = new Date();

    const city: CityStub = {
      id: this.nextId++,
      name: createCityDto.name,
      createdAt: now,
      updatedAt: now,
    };

    this.cities.push(city);
    return Promise.resolve(this.mapToResponseDto(city));
  }

  findAll(): Promise<CityResponseDto[]> {
    const result = [...this.cities]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((city) => this.mapToResponseDto(city));

    return Promise.resolve(result);
  }

  findOne(id: number): Promise<CityResponseDto> {
    const city = this.cities.find((c) => c.id === id);

    if (!city) {
      return Promise.reject(new EntityNotFoundException('City', id));
    }

    return Promise.resolve(this.mapToResponseDto(city));
  }

  update(id: number, updateCityDto: UpdateCityDto): Promise<CityResponseDto> {
    const city = this.cities.find((c) => c.id === id);

    if (!city) {
      return Promise.reject(new EntityNotFoundException('City', id));
    }

    if (updateCityDto.name !== undefined) {
      city.name = updateCityDto.name;
    }

    city.updatedAt = new Date();

    return Promise.resolve(this.mapToResponseDto(city));
  }

  remove(id: number): Promise<void> {
    const index = this.cities.findIndex((c) => c.id === id);

    if (index === -1) {
      return Promise.reject(new EntityNotFoundException('City', id));
    }

    this.cities.splice(index, 1);
    return Promise.resolve();
  }

  searchByName(name: string): Promise<CityResponseDto[]> {
    const needle = name.toLowerCase();

    const result = this.cities
      .filter((c) => c.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((city) => this.mapToResponseDto(city));

    return Promise.resolve(result);
  }

  private mapToResponseDto(city: CityStub): CityResponseDto {
    return {
      id: city.id,
      name: city.name,
      createdAt: city.createdAt.toISOString(),
      updatedAt: city.updatedAt.toISOString(),
    };
  }
}
