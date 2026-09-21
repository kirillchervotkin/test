// src/teams/team.controller.ts

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
import { TeamService } from './team.service.js';
import { CreateTeamDto } from './dto/createTeam.dto.js';
import { UpdateTeamDto } from './dto/updateTeam.dto.js';
import { TeamResponseDto } from './dto/teamResponse.dto.js';
import { FindTeamsQueryDto } from './dto/findTeamsQuery.dto.js';
import { TeamMapper } from './mappers/team.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

/**
 * Команды — глобальный справочник. Не привязаны к турниру,
 * поэтому маршруты плоские: /teams[/:id].
 */
@ApiTags('Команды')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ============================================================
  // 1. СОЗДАНИЕ КОМАНДЫ
  //
  // cityId опционален: команда может быть без домашнего города
  // (например, сборная). Если передан — репозиторий проверит
  // существование города внутри транзакции.
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать новую команду' })
  @ApiBody({ type: CreateTeamDto })
  @ApiCreatedResponse({
    description: 'Команда успешно создана',
    type: TeamResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiNotFoundResponse({ description: 'Город не найден' })
  async create(@Body() dto: CreateTeamDto): Promise<TeamResponseDto> {
    const data = TeamMapper.toCreateData(dto);
    const entity = await this.teamService.create(data);
    return TeamMapper.toDto(entity);
  }

  // ============================================================
  // 2. СПИСОК КОМАНД
  //
  // Режимы через query:
  //   - ?search=Зен      → частичный поиск по имени (автокомплит)
  //   - ?cityId=<uuid>   → все команды города
  //   - ?shortName=ЗЕН   → фильтр по короткому имени
  //   - без query        → все команды с сортировкой
  //
  // Пагинации нет: команд в системе сотни максимум.
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить список команд с фильтрацией и сортировкой',
  })
  @ApiResponse({
    status: 200,
    description: 'Список команд',
    type: [TeamResponseDto],
  })
  async findAll(@Query() query: FindTeamsQueryDto): Promise<TeamResponseDto[]> {
    let entities;

    if (query.search) {
      // Автокомплит: частичное совпадение по имени.
      entities = await this.teamService.searchByName(query.search);
    } else if (query.cityId && !query.shortName) {
      // Все команды указанного города (без других фильтров).
      entities = await this.teamService.findByCity(query.cityId);
    } else {
      // Обычный список с фильтрами и сортировкой.
      entities = await this.teamService.findAll({
        filter: {
          shortName: query.shortName,
          cityId: query.cityId,
        },
        orderBy: query.orderBy ?? 'name',
        orderDir: query.orderDir ?? 'ASC',
      });
    }

    return TeamMapper.toDtoList(entities);
  }

  // ============================================================
  // 3. ПОЛУЧЕНИЕ КОМАНДЫ ПО ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Получить команду по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID команды',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденная команда',
    type: TeamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Команда не найдена' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TeamResponseDto> {
    const entity = await this.teamService.findById(id);
    if (!entity) {
      throw new NotFoundException('Команда не найдена');
    }
    return TeamMapper.toDto(entity);
  }

  // ============================================================
  // 4. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ КОМАНДЫ
  //
  // `shortName: null` и `cityId: null` — допустимые значения
  // для обнуления соответствующих полей.
  //
  // Если cityId меняется на не-null — репозиторий проверит
  // существование города внутри транзакции.
  // ============================================================
  @Patch(':id')
  @ApiOperation({ summary: 'Обновить команду (частичное обновление)' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID команды',
  })
  @ApiBody({ type: UpdateTeamDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённая команда',
    type: TeamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Команда или город не найдены' })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    const data = TeamMapper.toUpdateData(id, dto);
    const updated = await this.teamService.update(data);
    return TeamMapper.toDto(updated);
  }

  // ============================================================
  // 5. УДАЛЕНИЕ КОМАНДЫ
  //
  // Пока простое удаление. Когда появится MatchRepository,
  // delete станет транзакционным и будет бросать
  // DbForeignKeyViolationException (409), если команда
  // участвует в матчах.
  // ============================================================
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить команду' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID команды',
  })
  @ApiNoContentResponse({ description: 'Команда удалена' })
  @ApiNotFoundResponse({ description: 'Команда не найдена' })
  @ApiConflictResponse({
    description: 'Невозможно удалить команду, так как она участвует в матчах',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.teamService.delete(id);
  }
}
