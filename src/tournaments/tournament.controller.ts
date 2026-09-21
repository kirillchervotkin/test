// src/tournaments/tournament.controller.ts

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
import { TOURNAMENTS_SERVICE } from './tokens.js';
import type { TournamentService } from './tournament.service.js';
import { CreateTournamentDto } from './dto/createTournament.dto.js';
import { UpdateTournamentDto } from './dto/updateTournament.dto.js';
import { TournamentResponseDto } from './dto/tournamentResponse.dto.js';
import { FindTournamentsQueryDto } from './dto/findTournamentsQuery.dto.js';
import { TournamentMapper } from './mappers/tournament.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

@ApiTags('Турниры')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tournaments')
export class TournamentController {
  constructor(
    @Inject(TOURNAMENTS_SERVICE)
    private readonly tournamentService: TournamentService,
  ) {}

  // ============================================================
  //  СОЗДАНИЕ ТУРНИРА
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать новый турнир' })
  @ApiBody({ type: CreateTournamentDto })
  @ApiCreatedResponse({
    description: 'Турнир успешно создан',
    type: TournamentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  async create(
    @Body() createDto: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    const createData = TournamentMapper.toCreateData(createDto);
    const entity = await this.tournamentService.create(createData);
    return TournamentMapper.toDto(entity);
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ СПИСКА ТУРНИРОВ
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить список турниров с фильтрацией и сортировкой',
  })
  @ApiResponse({
    status: 200,
    description: 'Список турниров',
    type: [TournamentResponseDto],
  })
  async findAll(
    @Query() query: FindTournamentsQueryDto,
  ): Promise<TournamentResponseDto[]> {
    const rows = await this.tournamentService.findAll({
      filter: { season: query.season, type: query.type },
      orderBy: query.orderBy ?? 'season',
      orderDir: query.orderDir ?? 'DESC',
    });
    return TournamentMapper.toDtoList(rows);
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ ТУРНИРА ПО ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Получить турнир по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID турнира',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденный турнир',
    type: TournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TournamentResponseDto> {
    const entity = await this.tournamentService.findById(id);
    if (!entity) {
      throw new NotFoundException('Турнир не найден');
    }
    return TournamentMapper.toDto(entity);
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ ТУРНИРА (частичное)
  // ============================================================
  @Patch(':id')
  @ApiOperation({ summary: 'Обновить турнир (частичное обновление)' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID турнира',
  })
  @ApiBody({ type: UpdateTournamentDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённый турнир',
    type: TournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTournamentDto,
  ): Promise<TournamentResponseDto> {
    const updateData = TournamentMapper.toUpdateData(id, updateDto);
    const updated = await this.tournamentService.update(updateData);
    return TournamentMapper.toDto(updated);
  }

  // ============================================================
  //  УДАЛЕНИЕ ТУРНИРА
  // ============================================================
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить турнир' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID турнира',
  })
  @ApiNoContentResponse({ description: 'Турнир удалён' })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  @ApiConflictResponse({
    description:
      'Невозможно удалить турнир, так как у него есть этапы (stages)',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.tournamentService.delete(id);
  }
}
