// src/stages/stage.controller.ts

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
import { STAGES_SERVICE } from './tokens.js';
import type { StageService } from './stage.service.js';
import { CreateStageDto } from './dto/createStage.dto.js';
import { UpdateStageDto } from './dto/updateStage.dto.js';
import { StageResponseDto } from './dto/stageResponse.dto.js';
import { FindStagesQueryDto } from './dto/findStagesQuery.dto.js';
import { StageMapper } from './mappers/stage.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

/**
 * Этапы — подресурс турнира. URL отражает это:
 *   /tournaments/:tournamentId/stages[/:stageId]
 *
 * Без турнира этап не существует. `tournamentId` берётся из path
 * при создании, при получении списка и при операциях над отдельным
 * этапом. Принадлежность этапа турниру проверяется на уровне
 * репозитория одним compound-запросом (`WHERE id AND tournament_id`):
 * если этап принадлежит другому турниру — возвращается 404.
 */
@ApiTags('Этапы турнира')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tournaments/:tournamentId/stages')
export class StageController {
  constructor(
    @Inject(STAGES_SERVICE)
    private readonly stageService: StageService,
  ) {}

  // ============================================================
  // 1. СОЗДАНИЕ ЭТАПА
  //
  // tournamentId берётся из URL — в теле не передаётся.
  // Репозиторий проверяет существование турнира (и родительского
  // этапа, если задан) внутри транзакции.
  //
  // Согласованность type ↔ format проверяется в CreateStageDto
  // кастомным валидатором IsValidStageFormat.
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать этап в турнире' })
  @ApiParam({ name: 'tournamentId', type: 'string', format: 'uuid' })
  @ApiBody({ type: CreateStageDto })
  @ApiCreatedResponse({
    description: 'Этап успешно создан',
    type: StageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Неверные данные. Например, format не соответствует type.',
  })
  @ApiNotFoundResponse({
    description: 'Турнир или родительский этап не найден',
  })
  async create(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Body() dto: CreateStageDto,
  ): Promise<StageResponseDto> {
    const data = StageMapper.toCreateData(tournamentId, dto);
    const entity = await this.stageService.create(data);
    return StageMapper.toDto(entity);
  }

  // ============================================================
  // 2. СПИСОК ЭТАПОВ ТУРНИРА
  //
  // Поддерживает режимы через query:
  //   - по умолчанию: все этапы турнира (включая контейнеры и дочерние)
  //   - rootOnly=true: только корневые (parentStageId IS NULL)
  //   - parentStageId=X: только дочерние указанного родителя
  //   - type=GROUP: фильтр по типу
  //
  // parentStageId имеет приоритет над rootOnly.
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить список этапов турнира',
    description:
      'Без query-параметров возвращает все этапы турнира. ' +
      'rootOnly=true — только корневые. parentStageId=X — только ' +
      'дочерние указанного этапа (приоритет над rootOnly). ' +
      'type=GROUP — фильтр по типу.',
  })
  @ApiParam({ name: 'tournamentId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Список этапов',
    type: [StageResponseDto],
  })
  async findAll(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query() query: FindStagesQueryDto,
  ): Promise<StageResponseDto[]> {
    let entities;

    if (query.parentStageId) {
      // Дочерние указанного родителя. Приоритет над rootOnly.
      entities = await this.stageService.findChildren(query.parentStageId);
    } else if (query.rootOnly) {
      // Только корневые этапы турнира.
      entities = await this.stageService.findRootByTournament(tournamentId);
    } else {
      // Все этапы турнира.
      entities = await this.stageService.findAllByTournament(tournamentId);
    }

    // Фильтр по типу — на уровне приложения. Этапов на турнир
    // единицы, поэтому фильтрация в памяти дешевле, чем отдельный
    // запрос в БД.
    if (query.type) {
      entities = entities.filter((s) => s.type === query.type);
    }

    return StageMapper.toDtoList(entities);
  }

  // ============================================================
  // 3. ДЕРЕВО ЭТАПОВ
  //
  // Возвращает иерархию: корневые этапы с вложенными children.
  // Удобно для UI — не нужно собирать дерево на клиенте.
  //
  // Объявлено ДО @Get(':stageId'), иначе 'tree' попал бы в :stageId.
  // ============================================================
  @Get('tree')
  @ApiOperation({
    summary: 'Получить дерево этапов турнира',
    description:
      'Возвращает корневые этапы с вложенными дочерними. ' +
      'Формат: [{ ...stage, children: [...] }].',
  })
  @ApiParam({ name: 'tournamentId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Дерево этапов',
    type: [StageResponseDto],
  })
  async findTree(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ): Promise<Array<StageResponseDto & { children: StageResponseDto[] }>> {
    const all = await this.stageService.findAllByTournament(tournamentId);

    // Строим дерево в памяти: этапов на турнир единицы.
    const byParent = new Map<string | null, StageResponseDto[]>();
    for (const s of all) {
      const key = s.parentStageId;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(StageMapper.toDto(s));
    }

    const buildTree = (
      parentId: string | null,
    ): Array<StageResponseDto & { children: StageResponseDto[] }> => {
      const children = byParent.get(parentId) ?? [];
      return children.map((child) => ({
        ...child,
        children: buildTree(child.id) as StageResponseDto[],
      }));
    };

    return buildTree(null);
  }

  // ============================================================
  // 4. ПОЛУЧЕНИЕ ЭТАПА ПО ID
  //
  // findByIdInTournament вернёт null, если этап не принадлежит
  // этому турниру — контроллер отдаст 404.
  // ============================================================
  @Get(':stageId')
  @ApiOperation({ summary: 'Получить этап по ID' })
  @ApiParam({ name: 'tournamentId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'stageId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Найденный этап',
    type: StageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Этап не найден или не принадлежит этому турниру',
  })
  async findOne(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ): Promise<StageResponseDto> {
    const entity = await this.stageService.findByIdInTournament(
      tournamentId,
      stageId,
    );
    if (!entity) {
      throw new NotFoundException('Этап не найден');
    }
    return StageMapper.toDto(entity);
  }

  // ============================================================
  // 5. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ ЭТАПА
  //
  // id берётся из path, а не из тела (см. StageMapper.toUpdateData).
  //
  // Согласованность type ↔ format после слияния патча проверяется
  // в сервисе (StageService.updateInTournament → isTypeFormatConsistent),
  // потому что DTO не видит текущего состояния сущности.
  //
  // `format: null`, `parentStageId: null`, `settings: null` —
  // допустимые значения для обнуления соответствующих полей.
  //
  // updateInTournament вернёт 404, если этап не принадлежит турниру.
  // ============================================================
  @Patch(':stageId')
  @ApiOperation({ summary: 'Обновить этап (частичное обновление)' })
  @ApiParam({ name: 'tournamentId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'stageId', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateStageDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённый этап',
    type: StageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Этап не найден или не принадлежит этому турниру',
  })
  @ApiBadRequestResponse({
    description:
      'Неверные данные. Например, после слияния патча нарушается ' +
      'согласованность type ↔ format.',
  })
  async update(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: UpdateStageDto,
  ): Promise<StageResponseDto> {
    const data = StageMapper.toUpdateData(stageId, dto);
    const updated = await this.stageService.updateInTournament(
      tournamentId,
      data,
    );
    return StageMapper.toDto(updated);
  }

  // ============================================================
  // 6. УДАЛЕНИЕ ЭТАПА
  //
  // Репозиторий проверяет дочерние этапы внутри транзакции.
  // Если есть хотя бы один дочерний — DbForeignKeyViolationException,
  // транслируется в 409 глобальным фильтром.
  //
  // deleteInTournament вернёт 404, если этап не принадлежит турниру.
  // ============================================================
  @Delete(':stageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить этап' })
  @ApiParam({ name: 'tournamentId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'stageId', type: 'string', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Этап удалён' })
  @ApiNotFoundResponse({
    description: 'Этап не найден или не принадлежит этому турниру',
  })
  @ApiConflictResponse({
    description: 'Невозможно удалить этап, так как у него есть дочерние этапы',
  })
  async remove(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
  ): Promise<void> {
    await this.stageService.deleteInTournament(tournamentId, stageId);
  }
}
