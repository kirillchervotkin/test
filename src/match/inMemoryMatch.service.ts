import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MatchService } from './interfaces/matchService.interface.js';
import { MatchResponseDto } from './dto/matchResponse.dto.js';
import { CreateMatchDto } from './dto/createMatch.dto.js';
import { UpdateMatchDto } from './dto/updateMatch.dto.js';

@Injectable()
export class InMemoryMatchService implements MatchService {
  private matches: MatchResponseDto[] = [
    {
      id: 1,
      tournamentId: 2,
      groupId: 1,
      matchDate: '2023-09-19T20:00:00Z',
      cityId: 1, // Мюнхен
      homeTeamId: 1, // Бавария
      awayTeamId: 2, // Манчестер Юнайтед
      homeScore: 4,
      awayScore: 3,
      createdAt: '2023-08-01T00:00:00.000Z',
      updatedAt: '2023-09-20T00:00:00.000Z',
    },
    {
      id: 2,
      tournamentId: 2,
      groupId: 1,
      matchDate: '2023-09-20T19:45:00Z',
      cityId: 2, // Мадрид
      homeTeamId: 3, // Реал Мадрид
      awayTeamId: 4, // Наполи
      homeScore: 3,
      awayScore: 2,
      createdAt: '2023-08-01T00:00:00.000Z',
      updatedAt: '2023-09-21T00:00:00.000Z',
    },
    {
      id: 3,
      tournamentId: 2,
      groupId: 2,
      matchDate: '2023-10-03T20:00:00Z',
      cityId: 3, // Париж
      homeTeamId: 5, // ПСЖ
      awayTeamId: 6, // Милан
      homeScore: 2,
      awayScore: 0,
      createdAt: '2023-08-01T00:00:00.000Z',
      updatedAt: '2023-10-04T00:00:00.000Z',
    },
    {
      id: 4,
      tournamentId: 3,
      matchDate: '2023-08-12T15:00:00Z',
      cityId: 4, // Лондон
      homeTeamId: 7, // Арсенал
      awayTeamId: 8, // Манчестер Сити
      homeScore: 1,
      awayScore: 1,
      createdAt: '2023-07-01T00:00:00.000Z',
      updatedAt: '2023-08-13T00:00:00.000Z',
    },
    {
      id: 5,
      tournamentId: 3,
      groupId: 3,
      matchDate: '2024-01-27T12:30:00Z',
      cityId: 5, // Ливерпуль
      homeTeamId: 9, // Ливерпуль
      awayTeamId: 10, // Норвич Сити
      homeScore: null,
      awayScore: null,
      createdAt: '2023-12-01T00:00:00.000Z',
      updatedAt: '2023-12-01T00:00:00.000Z',
    },
    {
      id: 6,
      tournamentId: 1,
      matchDate: '2023-09-21T17:45:00Z',
      cityId: 6, // Рим
      homeTeamId: 11, // Рома
      awayTeamId: 12, // Брайтон
      homeScore: 1,
      awayScore: 0,
      createdAt: '2023-08-15T00:00:00.000Z',
      updatedAt: '2023-09-22T00:00:00.000Z',
    },
  ];

  private idCounter = 7;

  create(
    tournamentId: number,
    createMatchDto: CreateMatchDto,
    groupId?: number,
  ): MatchResponseDto {
    // Проверяем, что команды не одинаковые
    if (createMatchDto.homeTeamId === createMatchDto.awayTeamId) {
      throw new BadRequestException('Команды не могут быть одинаковыми');
    }

    const now = new Date().toISOString();
    const newMatch: MatchResponseDto = {
      id: this.idCounter++,
      tournamentId,
      groupId: groupId || null,
      matchDate: createMatchDto.matchDate,
      cityId: createMatchDto.cityId, // Используем cityId вместо venue
      homeTeamId: createMatchDto.homeTeamId,
      awayTeamId: createMatchDto.awayTeamId,
      homeScore: createMatchDto.homeScore || null,
      awayScore: createMatchDto.awayScore || null,
      createdAt: now,
      updatedAt: now,
    };

    this.matches.push(newMatch);
    return newMatch;
  }

  findAllByTournament(tournamentId: number): MatchResponseDto[] {
    return this.matches.filter((match) => match.tournamentId === tournamentId);
  }

  findAllByGroup(tournamentId: number, groupId: number): MatchResponseDto[] {
    return this.matches.filter(
      (match) =>
        match.tournamentId === tournamentId && match.groupId === groupId,
    );
  }

  findOne(id: number): MatchResponseDto {
    const match = this.matches.find((m) => m.id === id);
    if (!match) {
      throw new NotFoundException(`Матч с ID ${id} не найден`);
    }
    return match;
  }

  update(id: number, updateMatchDto: UpdateMatchDto): MatchResponseDto {
    const index = this.matches.findIndex((m) => m.id === id);

    if (index === -1) {
      throw new NotFoundException(`Матч с ID ${id} не найден`);
    }

    // Проверяем, что команды не одинаковые (если они обновляются)
    if (
      updateMatchDto.homeTeamId !== undefined &&
      updateMatchDto.awayTeamId !== undefined &&
      updateMatchDto.homeTeamId === updateMatchDto.awayTeamId
    ) {
      throw new BadRequestException('Команды не могут быть одинаковыми');
    }

    const updatedMatch = {
      ...this.matches[index],
      ...updateMatchDto,
      updatedAt: new Date().toISOString(),
    };

    this.matches[index] = updatedMatch;
    return updatedMatch;
  }

  remove(id: number): { message: string } {
    const index = this.matches.findIndex((m) => m.id === id);

    if (index === -1) {
      throw new NotFoundException(`Матч с ID ${id} не найден`);
    }

    this.matches.splice(index, 1);
    return { message: `Матч с ID ${id} успешно удален` };
  }

  removeFromGroup(
    tournamentId: number,
    groupId: number,
    matchId: number,
  ): { message: string } {
    const match = this.matches.find(
      (m) =>
        m.id === matchId &&
        m.tournamentId === tournamentId &&
        m.groupId === groupId,
    );

    if (!match) {
      throw new NotFoundException(
        `Матч с ID ${matchId} не найден в турнире ${tournamentId} и группе ${groupId}`,
      );
    }

    const index = this.matches.indexOf(match);
    this.matches.splice(index, 1);
    return {
      message: `Матч с ID ${matchId} успешно удален из турнира ${tournamentId} и группы ${groupId}`,
    };
  }

  removeFromTournament(
    tournamentId: number,
    matchId: number,
  ): { message: string } {
    const match = this.matches.find(
      (m) => m.id === matchId && m.tournamentId === tournamentId,
    );

    if (!match) {
      // Проверяем, существует ли матч вообще
      const matchExists = this.matches.find((m) => m.id === matchId);
      if (!matchExists) {
        throw new NotFoundException(`Матч с ID ${matchId} не найден`);
      }

      // Если матч существует, но не принадлежит указанному турниру
      throw new BadRequestException(
        `Матч с ID ${matchId} не принадлежит указанному турниру ${tournamentId}`,
      );
    }

    const index = this.matches.indexOf(match);
    this.matches.splice(index, 1);
    return {
      message: `Матч с ID ${matchId} успешно удален из турнира ${tournamentId}`,
    };
  }

  // Дополнительные методы для удобства

  findMatchesByTeam(teamId: number): MatchResponseDto[] {
    return this.matches.filter(
      (match) => match.homeTeamId === teamId || match.awayTeamId === teamId,
    );
  }

  findMatchesBetweenTeams(
    team1Id: number,
    team2Id: number,
  ): MatchResponseDto[] {
    return this.matches.filter(
      (match) =>
        (match.homeTeamId === team1Id && match.awayTeamId === team2Id) ||
        (match.homeTeamId === team2Id && match.awayTeamId === team1Id),
    );
  }
}
