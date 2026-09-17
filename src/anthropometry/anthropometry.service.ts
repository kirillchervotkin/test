import { Injectable, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { CreateAnthropometricDataDto } from './dto/createAnthropometricData.dto.js';
import { GetAnthropometryQueryDto } from './dto/getAnthropometryQuery.dto.js';
import { AnthropometricDataResponseDto } from './dto/responses/anthropometricDataResponse.dto.js';

interface AnthropometricDataStub {
  id: number;
  userId: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

@Injectable()
export class AnthropometryService {
  private anthropometricData: AnthropometricDataStub[] = [];
  private nextId = 1;

  create(
    userId: number,
    createDto: CreateAnthropometricDataDto,
  ): Promise<AnthropometricDataResponseDto> {
    const now = new Date();

    const entity: AnthropometricDataStub = {
      ...createDto,
      id: this.nextId++,
      userId,
      date: now,
      createdAt: now,
      updatedAt: now,
    };

    this.anthropometricData.push(entity);

    return Promise.resolve(
      plainToInstance(AnthropometricDataResponseDto, entity, {
        excludeExtraneousValues: true,
      }),
    );
  }

  findAllByUserId(
    userId: number,
    dateFilter: GetAnthropometryQueryDto,
  ): Promise<AnthropometricDataResponseDto[]> {
    let result = this.anthropometricData.filter(
      (item) => item.userId === userId,
    );

    if (dateFilter?.from) {
      const from = new Date(dateFilter.from);
      result = result.filter((item) => item.date >= from);
    }

    if (dateFilter?.to) {
      const to = new Date(dateFilter.to);
      result = result.filter((item) => item.date <= to);
    }

    result = [...result].sort((a, b) => b.date.getTime() - a.date.getTime());

    return Promise.resolve(
      result.map((entity) =>
        plainToInstance(AnthropometricDataResponseDto, entity, {
          excludeExtraneousValues: true,
        }),
      ),
    );
  }

  remove(userId: number, id: number): Promise<void> {
    const index = this.anthropometricData.findIndex(
      (item) => item.id === id && item.userId === userId,
    );

    if (index === -1) {
      return Promise.reject(
        new NotFoundException(
          `Anthropometric data with ID ${id} not found for user ${userId}`,
        ),
      );
    }

    this.anthropometricData.splice(index, 1);
    return Promise.resolve();
  }
}
