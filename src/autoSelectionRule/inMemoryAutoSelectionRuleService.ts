import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AutoSelectionRuleService } from './interfaces/autoSelectionRuleService.interface.js';
import { AutoSelectionRuleResponseDto } from './dto/autoSelectionRuleResponse.dto.js';
import { CreateAutoSelectionRuleDto } from './dto/createAutoSelectionRule.dto.js';
import { UpdateAutoSelectionRuleDto } from './dto/updateAutoSelectionRule.dto.js';

@Injectable()
export class InMemoryAutoSelectionRuleService
  implements AutoSelectionRuleService
{
  private rules: AutoSelectionRuleResponseDto[] = [
    {
      id: 1,
      tournamentId: 5,
      fieldRoleId: 10,
      listId: 42,
      createdAt: '2024-01-01T10:00:00.000Z',
      updatedAt: '2024-01-01T10:00:00.000Z',
    },
    {
      id: 2,
      tournamentId: 5,
      fieldRoleId: 11,
      listId: 43,
      createdAt: '2024-01-01T11:00:00.000Z',
      updatedAt: '2024-01-01T11:00:00.000Z',
    },
    {
      id: 3,
      tournamentId: 6,
      fieldRoleId: 10,
      listId: 45,
      createdAt: '2024-01-02T10:00:00.000Z',
      updatedAt: '2024-01-02T10:00:00.000Z',
    },
  ];

  private idCounter = 4;

  create(
    tournamentId: number,
    createDto: CreateAutoSelectionRuleDto,
  ): AutoSelectionRuleResponseDto {
    const existingRule = this.rules.find(
      (rule) =>
        rule.tournamentId === tournamentId &&
        rule.fieldRoleId === createDto.fieldRoleId,
    );

    if (existingRule) {
      throw new BadRequestException(
        `Правило для роли ${createDto.fieldRoleId} в турнире ${tournamentId} уже существует`,
      );
    }

    const now = new Date().toISOString();
    const newRule: AutoSelectionRuleResponseDto = {
      id: this.idCounter++,
      tournamentId,
      ...createDto,
      createdAt: now,
      updatedAt: now,
    };

    this.rules.push(newRule);
    return newRule;
  }

  findAll(tournamentId: number): AutoSelectionRuleResponseDto[] {
    return this.rules
      .filter((rule) => rule.tournamentId === tournamentId)
      .sort((a, b) => a.id - b.id);
  }

  findOne(tournamentId: number, id: number): AutoSelectionRuleResponseDto {
    const rule = this.rules.find(
      (r) => r.tournamentId === tournamentId && r.id === id,
    );
    if (!rule) {
      throw new NotFoundException(
        `Правило автоподбора с ID ${id} для турнира ${tournamentId} не найдено`,
      );
    }
    return rule;
  }

  update(
    tournamentId: number,
    id: number,
    updateDto: UpdateAutoSelectionRuleDto,
  ): AutoSelectionRuleResponseDto {
    const index = this.rules.findIndex(
      (r) => r.tournamentId === tournamentId && r.id === id,
    );

    if (index === -1) {
      throw new NotFoundException(
        `Правило автоподбора с ID ${id} для турнира ${tournamentId} не найдено`,
      );
    }

    const updatedRule = {
      ...this.rules[index],
      ...updateDto,
      updatedAt: new Date().toISOString(),
    };

    this.rules[index] = updatedRule;
    return updatedRule;
  }

  remove(tournamentId: number, id: number): { message: string } {
    const index = this.rules.findIndex(
      (r) => r.tournamentId === tournamentId && r.id === id,
    );

    if (index === -1) {
      throw new NotFoundException(
        `Правило автоподбора с ID ${id} для турнира ${tournamentId} не найдено`,
      );
    }

    this.rules.splice(index, 1);
    return { message: `Правило автоподбора с ID ${id} успешно удалено` };
  }
}
