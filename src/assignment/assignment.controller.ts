// src/assignments/assignment.controller.ts

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
import { ASSIGNMENTS_SERVICE } from './tokens.js';
import type { AssignmentService } from './assignment.service.js';
import { CreateAssignmentDto } from './dto/createAssignment.dto.js';
import { UpdateAssignmentDto } from './dto/updateAssignment.dto.js';
import { AssignmentResponseDto } from './dto/assignmentResponse.dto.js';
import { FindAssignmentsQueryDto } from './dto/findAssignmentsQuery.dto.js';
import { AssignmentMapper } from './mappers/assignment.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

/**
 * Назначения — подресурс матча. URL отражает это:
 *   /matches/:matchId/assignments[/:assignmentId]
 *
 * `matchId` берётся из path при создании и при получении списка;
 * в теле DTO его нет. Матч назначения не меняется — перенос
 * на другой матч это delete + create.
 *
 * Отдельное назначение идентифицируется своим UUID:
 *   /assignments/:id
 *
 * Все проверки (матч, судья, роль, дубликат на матче, «два матча
 * в день») выполняются в репозитории внутри одной транзакции.
 * Контроллер только вызывает сервис и маппит результат.
 *
 * Эндпоинт `GET /matches/:matchId/crew` (матч с бригадой и ФИО)
 * реализован в отдельном `MatchCrewController`.
 */
@ApiTags('Назначения')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class AssignmentController {
  constructor(
    @Inject(ASSIGNMENTS_SERVICE)
    private readonly assignmentService: AssignmentService,
  ) {}

  // ============================================================
  // 1. СОЗДАНИЕ НАЗНАЧЕНИЯ
  //
  // `matchId` берётся из URL — в теле не передаётся.
  //
  // В репозитории (в одной транзакции) проверяется:
  //   - матч существует;
  //   - судья существует;
  //   - роль существует;
  //   - судья не назначен на этот матч дважды;
  //   - судья не назначен на другой матч в тот же день.
  // ============================================================
  @Post('matches/:matchId/assignments')
  @ApiOperation({ summary: 'Назначить судью на матч' })
  @ApiParam({ name: 'matchId', type: 'string', format: 'uuid' })
  @ApiBody({ type: CreateAssignmentDto })
  @ApiCreatedResponse({
    description: 'Назначение успешно создано',
    type: AssignmentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiNotFoundResponse({
    description: 'Матч, судья или роль не найдены',
  })
  @ApiConflictResponse({
    description:
      'Судья уже назначен на этот матч или на другой матч в тот же день',
  })
  async create(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: CreateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    const data = AssignmentMapper.toCreateData(matchId, dto);
    const entity = await this.assignmentService.create(data);
    return AssignmentMapper.toDto(entity);
  }

  // ============================================================
  // 2. СПИСОК НАЗНАЧЕНИЙ МАТЧА
  //
  // Без деталей (ФИО судьи, название роли) — только ID-ссылки.
  // Для отображения бригады с ФИО используйте
  // GET /matches/:matchId/crew (в MatchCrewController).
  // ============================================================
  @Get('matches/:matchId/assignments')
  @ApiOperation({ summary: 'Получить список назначений матча' })
  @ApiParam({ name: 'matchId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Список назначений матча',
    type: [AssignmentResponseDto],
  })
  async findAllByMatch(
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ): Promise<AssignmentResponseDto[]> {
    const entities = await this.assignmentService.findAllByMatch(matchId);
    return AssignmentMapper.toDtoList(entities);
  }

  // ============================================================
  // 3. ГЛОБАЛЬНЫЙ СПИСОК НАЗНАЧЕНИЙ С ФИЛЬТРАМИ
  //
  // Сценарии:
  //   - «где судил Петров» → ?userId=X
  //   - «все назначения VAR» → ?fieldRoleId=X
  //   - «назначения за неделю» → ?dateFrom=&dateTo=
  //
  // Без пагинации: назначения всегда смотрят с фильтром,
  // без фильтра список бессмысленен (2000 записей за сезон
  // никто не листает).
  // ============================================================
  @Get('assignments')
  @ApiOperation({
    summary: 'Получить список назначений с фильтрами',
    description:
      'Для отчётов: где судил Петров, все VAR, назначения ' +
      'за период. Без пагинации — всегда с фильтром.',
  })
  @ApiResponse({
    status: 200,
    description: 'Список назначений',
    type: [AssignmentResponseDto],
  })
  async findAll(
    @Query() query: FindAssignmentsQueryDto,
  ): Promise<AssignmentResponseDto[]> {
    const entities = await this.assignmentService.findAll({
      filter: {
        matchId: query.matchId,
        userId: query.userId,
        fieldRoleId: query.fieldRoleId,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      },
      orderDir: query.orderDir ?? 'ASC',
    });
    return AssignmentMapper.toDtoList(entities);
  }

  // ============================================================
  // 4. ПОЛУЧЕНИЕ НАЗНАЧЕНИЯ ПО ID
  //
  // Назначение идентифицируется своим UUID. Проверка
  // «принадлежит ли оно матчу» не делается: UUID глобально
  // уникален, а matchId назначения не меняется.
  // ============================================================
  @Get('assignments/:id')
  @ApiOperation({ summary: 'Получить назначение по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID назначения',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденное назначение',
    type: AssignmentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Назначение не найдено' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AssignmentResponseDto> {
    const entity = await this.assignmentService.findById(id);
    if (!entity) {
      throw new NotFoundException('Назначение не найдено');
    }
    return AssignmentMapper.toDto(entity);
  }

  // ============================================================
  // 5. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ НАЗНАЧЕНИЯ
  //
  // `matchId` не меняется: перенос на другой матч — это
  // delete + create.
  //
  // При смене `userId` репозиторий повторно проверяет нового
  // судью: существует, нет дубликата на матче (исключая текущее
  // назначение), нет другого матча в тот же день (исключая
  // текущий матч).
  //
  // При смене `fieldRoleId` — проверяет, что роль существует.
  // ============================================================
  @Patch('assignments/:id')
  @ApiOperation({ summary: 'Обновить назначение (частичное обновление)' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID назначения',
  })
  @ApiBody({ type: UpdateAssignmentDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённое назначение',
    type: AssignmentResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Назначение, судья или роль не найдены',
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description:
      'Новый судья уже назначен на этот матч или на другой матч ' +
      'в тот же день',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssignmentDto,
  ): Promise<AssignmentResponseDto> {
    const data = AssignmentMapper.toUpdateData(id, dto);
    const updated = await this.assignmentService.update(data);
    return AssignmentMapper.toDto(updated);
  }

  // ============================================================
  // 6. УДАЛЕНИЕ НАЗНАЧЕНИЯ
  //
  // Ссылок на назначение из других таблиц нет — простое удаление.
  // ============================================================
  @Delete('assignments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить назначение' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID назначения',
  })
  @ApiNoContentResponse({ description: 'Назначение удалено' })
  @ApiNotFoundResponse({ description: 'Назначение не найдено' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.assignmentService.delete(id);
  }
}
