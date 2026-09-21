// src/matches/match.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { MATCHES_SERVICE } from './tokens.js';
import type { MatchService } from './match.service.js';
import { CreateMatchDto } from './dto/createMatch.dto.js';
import { UpdateMatchDto } from './dto/updateMatch.dto.js';
import { MatchResponseDto } from './dto/matchResponse.dto.js';
import { PaginatedMatchResponseDto } from './dto/paginated-match-response.dto.js';
import { FindMatchesQueryDto } from './dto/findMatchesQuery.dto.js';
import { MatchMapper } from './mappers/match.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

/**
 * Матчи доступны через два набора маршрутов:
 *
 *   1. В контексте этапа (основной сценарий UI):
 *        POST /stages/:stageId/matches
 *        GET  /stages/:stageId/matches
 *      Админ находится внутри этапа — форма создания матча
 *      не спрашивает ни турнир, ни этап. `stageId` уже в URL.
 *
 *   2. Глобальный список (отчёты, поиск по всем турнирам):
 *        GET /tournaments/:tournamentId/matches — все матчи турнира
 *        GET /matches                             — с фильтрами и пагинацией
 *
 * Отдельный матч идентифицируется своим UUID:
 *        GET/PATCH/DELETE /matches/:id
 *
 * `tournamentId` матча выводится из `stage.tournamentId` на
 * бэкенде (в MatchRepository, в одной транзакции с INSERT).
 * Клиент его нигде не передаёт — несогласованность
 * `stage ↔ tournament` невозможна by design.
 */
@ApiTags('Матчи')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class MatchController {
  constructor(
    @Inject(MATCHES_SERVICE)
    private readonly matchService: MatchService,
  ) {}

  // ============================================================
  // 1. СОЗДАНИЕ МАТЧА В ЭТАПЕ
  //
  // Основной сценарий: админ внутри этапа.
  //
  // `stageId` берётся из URL — в теле не передаётся.
  // `tournamentId` матча выводится репозиторием из stage.
  //
  // Согласованность `tourNumber ↔ stage.format` проверяется
  // репозиторием в той же транзакции, что и INSERT.
  // ============================================================
  @Post('stages/:stageId/matches')
  @ApiOperation({
    summary: 'Создать матч в этапе',
    description:
      'Основной сценарий: админ находится внутри этапа. ' +
      'stageId берётся из URL. tournamentId матча выводится ' +
      'из stage на бэкенде.',
  })
  @ApiParam({ name: 'stageId', type: 'string', format: 'uuid' })
  @ApiBody({ type: CreateMatchDto })
  @ApiCreatedResponse({
    description: 'Матч успешно создан',
    type: MatchResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Неверные данные. Например, tourNumber передан для плей-офф ' +
      'или не передан для кругового этапа.',
  })
  @ApiNotFoundResponse({
    description: 'Этап, город или команда не найдены',
  })
  async createInStage(
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: CreateMatchDto,
  ): Promise<MatchResponseDto> {
    // stageId подставляем в DTO: он приходит из URL, а не из тела.
    // Если клиент передал другой stageId в теле — игнорируем.
    const data = MatchMapper.toCreateData({ ...dto, stageId });
    const entity = await this.matchService.create(data);
    return MatchMapper.toDto(entity);
  }

  // ============================================================
  // 2. СПИСОК МАТЧЕЙ ЭТАПА
  //
  // Все матчи этапа, отсортированы по дате.
  // Без пагинации: матчей на этапе единицы или десятки.
  // ============================================================
  @Get('stages/:stageId/matches')
  @ApiOperation({
    summary: 'Получить список матчей этапа',
    description:
      'Все матчи этапа, отсортированы по дате. Без пагинации: ' +
      'матчей на этапе единицы или десятки.',
  })
  @ApiParam({ name: 'stageId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Список матчей этапа',
    type: [MatchResponseDto],
  })
  async findAllByStage(
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ): Promise<MatchResponseDto[]> {
    const entities = await this.matchService.findAllByStage(stageId);
    return MatchMapper.toDtoList(entities);
  }

  // ============================================================
  // 3. СПИСОК МАТЧЕЙ ТУРНИРА
  //
  // Все матчи турнира, отсортированы по дате.
  // Без пагинации: турнир — это сезон, матчей сотни.
  //
  // Здесь `tournamentId` реально используется — он передаётся
  // в сервис для фильтрации.
  // ============================================================
  @Get('tournaments/:tournamentId/matches')
  @ApiOperation({
    summary: 'Получить список матчей турнира',
    description: 'Все матчи турнира, отсортированы по дате. Без пагинации.',
  })
  @ApiParam({ name: 'tournamentId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Список матчей турнира',
    type: [MatchResponseDto],
  })
  async findAllByTournament(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ): Promise<MatchResponseDto[]> {
    const entities = await this.matchService.findAllByTournament(tournamentId);
    return MatchMapper.toDtoList(entities);
  }

  // ============================================================
  // 4. ГЛОБАЛЬНЫЙ СПИСОК МАТЧЕЙ С ФИЛЬТРАМИ И ПАГИНАЦИЕЙ
  //
  // Сценарий: отчёты, поиск по всем турнирам.
  //
  // Поддерживает фильтры: tournamentId, stageId, cityId, teamId,
  // tourNumber, dateFrom, dateTo. Пагинация через limit/offset.
  // ============================================================
  @Get('matches')
  @ApiOperation({
    summary: 'Получить список матчей с фильтрами и пагинацией',
    description:
      'Для отчётов и поиска по всем турнирам. Поддерживает ' +
      'фильтры по турниру, этапу, городу, команде, туру, датам. ' +
      'Возвращает { rows, total }.',
  })
  @ApiResponse({
    status: 200,
    description: 'Постраничный список матчей',
    type: PaginatedMatchResponseDto,
  })
  async findAll(
    @Query() query: FindMatchesQueryDto,
  ): Promise<PaginatedMatchResponseDto> {
    const result = await this.matchService.findAll({
      filter: {
        tournamentId: query.tournamentId,
        stageId: query.stageId,
        cityId: query.cityId,
        teamId: query.teamId,
        tourNumber: query.tourNumber,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      },
      limit: query.limit,
      offset: query.offset,
      orderBy: query.orderBy ?? 'matchDate',
      orderDir: query.orderDir ?? 'ASC',
    });

    return {
      rows: MatchMapper.toDtoList(result.rows),
      total: result.total,
    };
  }

  // ============================================================
  // 5. ПОЛУЧЕНИЕ МАТЧА ПО ID
  // ============================================================
  @Get('matches/:id')
  @ApiOperation({ summary: 'Получить матч по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID матча',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденный матч',
    type: MatchResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Матч не найден' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MatchResponseDto> {
    const entity = await this.matchService.findById(id);
    if (!entity) {
      throw new NotFoundException('Матч не найден');
    }
    return MatchMapper.toDto(entity);
  }

  // ============================================================
  // 6. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ МАТЧА
  // ============================================================
  @Patch('matches/:id')
  @ApiOperation({ summary: 'Обновить матч (частичное обновление)' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID матча',
  })
  @ApiBody({ type: UpdateMatchDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённый матч',
    type: MatchResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Матч, город или команда не найдены',
  })
  @ApiBadRequestResponse({
    description:
      'Неверные данные. Например, homeTeamId и awayTeamId совпадают.',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatchDto,
  ): Promise<MatchResponseDto> {
    const data = MatchMapper.toUpdateData(id, dto);
    const updated = await this.matchService.update(data);
    return MatchMapper.toDto(updated);
  }

  // ============================================================
  // 7. УДАЛЕНИЕ МАТЧА
  // ============================================================
  @Delete('matches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить матч' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID матча',
  })
  @ApiNoContentResponse({ description: 'Матч удалён' })
  @ApiNotFoundResponse({ description: 'Матч не найден' })
  @ApiConflictResponse({
    description: 'Невозможно удалить матч, так как на него есть назначения',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.matchService.delete(id);
  }
}
