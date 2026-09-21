// src/assignments/match-crew.controller.ts

import {
  Controller,
  Get,
  Param,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ASSIGNMENTS_SERVICE } from './tokens.js';
import type { AssignmentService } from './assignment.service.js';
import { MatchCrewResponseDto } from './dto/matchCrewResponse.dto.js';
import { AssignmentMapper } from './mappers/assignment.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

/**
 * MatchCrewController — read-only представление «матч с бригадой».
 *
 * Отдаёт всё, что нужно для страницы матча, одним запросом:
 * матч (дата, счёт, этап, город), команды (названия) и бригаду
 * (ФИО судей, роли, порядок).
 *
 * Живёт в модуле assignments, потому что основная логика — это
 * бригада. Контекст матча читается репозиторием назначений
 * напрямую через схему matches — без зависимости от MatchModule.
 *
 * Отделён от AssignmentController, потому что:
 *   - разные задачи: CRUD назначений vs read-only представление;
 *   - разные паттерны доступа: запись vs чтение;
 *   - разные ответы: массив назначений vs склеенный объект.
 */
@ApiTags('Назначения')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('matches')
export class MatchCrewController {
  constructor(
    @Inject(ASSIGNMENTS_SERVICE)
    private readonly assignmentService: AssignmentService,
  ) {}

  // ============================================================
  // GET /matches/:matchId/crew
  //
  // Один вызов сервиса → один ответ:
  //   - AssignmentService.getMatchCrew(matchId) читает матч
  //     с деталями и бригаду с ФИО.
  //   - 404, если матч не существует.
  //   - Пустая бригада — валидное состояние (не 404).
  // ============================================================
  @Get(':matchId/crew')
  @ApiOperation({
    summary: 'Получить матч с бригадой',
    description:
      'Матч (дата, счёт, этап, город) + команды (названия) + ' +
      'бригада (ФИО судей, роли, порядок). Один запрос для ' +
      'страницы матча. Пустая бригада — валидное состояние.',
  })
  @ApiParam({ name: 'matchId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Матч с бригадой',
    type: MatchCrewResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Матч не найден' })
  async getCrew(
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ): Promise<MatchCrewResponseDto> {
    const data = await this.assignmentService.getMatchCrew(matchId);
    if (!data) {
      throw new NotFoundException('Матч не найден');
    }

    const { match, crew } = data;

    return {
      matchId: match.id,
      matchDate: match.matchDate,
      tourNumber: match.tourNumber,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeTeamId: match.homeTeamId,
      homeTeamName: match.homeTeamName,
      awayTeamId: match.awayTeamId,
      awayTeamName: match.awayTeamName,
      cityId: match.cityId,
      cityName: match.cityName,
      stageId: match.stageId,
      stageName: match.stageName,
      crew: AssignmentMapper.toWithDetailsDtoList(crew),
    };
  }
}
