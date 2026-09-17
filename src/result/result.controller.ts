// src/results/result.controller.ts

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
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { ResultService } from './result.service.js';
import { CreateResultsDto } from './dto/create-results.dto.js';
import { UploadResultsDto } from './dto/upload-results.dto.js';
import { UpdateResultDto } from './dto/update-result.dto.js';
import { ResultResponseDto } from './dto/response.dto.js';
import { ResultMapper } from './mappers/result.mapper.js';
import { RESULT_STATUSES } from './entities/types/result.types.js';
import type { ResultStatus } from './entities/types/result.types.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

@ApiTags('Results')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultController {
  constructor(private readonly service: ResultService) {}

  // ============================================================
  // 1. MASS UPSERT (обновление/вставка для всего сбора)
  // Типы тестов передаются в теле запроса (testTypeIds).
  //
  // В одном слоте (user, camp, is_10m, leg) теперь может быть
  // несколько результатов — по одному на каждый уникальный
  // набор testTypeIds. Логика поиска/создания в репозитории:
  //   - нашли результат с пересекающимся набором → обновляем;
  //   - не нашли → создаём новую строку с новым id.
  // ============================================================
  @Post('training-camps/:campId')
  @ApiOperation({
    summary: 'Upsert results for all users in a training camp',
    description:
      'Updates existing results or inserts new ones based on ' +
      '(user_id, training_camp_id, is_10m, leg_number, testTypeIds). ' +
      'Types of tests are provided in the body as testTypeIds. ' +
      'A slot may contain multiple results — one per unique testTypeIds set.',
  })
  @ApiParam({ name: 'campId', type: 'string', format: 'uuid' })
  @ApiBody({ type: UploadResultsDto })
  @ApiCreatedResponse({
    description: 'Results upserted successfully',
    type: [ResultResponseDto],
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiNotFoundResponse({ description: 'Camp or users not found' })
  async uploadResults(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Body() dto: UploadResultsDto,
  ): Promise<ResultResponseDto[]> {
    const data = ResultMapper.toUploadResultsData(campId, dto);
    const entities = await this.service.uploadResults(
      campId,
      data,
      dto.testTypeIds,
    );
    return entities.map(({ result, testTypeIds }) =>
      ResultMapper.toDto(result, testTypeIds),
    );
  }

  // ============================================================
  // 2. UPSERT РЕЗУЛЬТАТОВ ОДНОГО ПОЛЬЗОВАТЕЛЯ В СБОРЕ
  //
  // Работает по тому же принципу, что и массовый upsert:
  // в одном слоте может быть несколько результатов, каждый со
  // своим набором testTypeIds. id и связи в result_test_types
  // сохраняются при обновлении.
  // ============================================================
  @Post('training-camps/:campId/users/:userId')
  @ApiOperation({
    summary: 'Upsert results for a single user in a training camp',
    description:
      'Updates existing results or inserts new ones based on ' +
      '(user_id, training_camp_id, is_10m, leg_number, testTypeIds). ' +
      'Types of tests are provided in the body as testTypeIds. ' +
      'A slot may contain multiple results — one per unique testTypeIds set.',
  })
  @ApiParam({ name: 'campId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiBody({ type: CreateResultsDto })
  @ApiCreatedResponse({
    description: 'Results upserted successfully',
    type: [ResultResponseDto],
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiNotFoundResponse({ description: 'Camp or user not found' })
  async uploadUserResults(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateResultsDto,
  ): Promise<ResultResponseDto[]> {
    const data = ResultMapper.toCreateBulkData(userId, campId, dto);
    const entities = await this.service.uploadResults(
      campId,
      data,
      dto.testTypeIds,
    );
    return entities.map(({ result, testTypeIds }) =>
      ResultMapper.toDto(result, testTypeIds),
    );
  }

  // ============================================================
  // 3. ПОЛУЧИТЬ ВСЕ РЕЗУЛЬТАТЫ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ В СБОРЕ ДЛЯ ТИПА
  // ============================================================
  @Get('types/:testTypeId/training-camps/:campId')
  @ApiOperation({
    summary:
      'Get all results for all users in a training camp for a specific test type',
  })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'campId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'List of results for the camp and test type',
    type: [ResultResponseDto],
  })
  async findAllByCamp(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Param('campId', ParseUUIDPipe) campId: string,
  ): Promise<ResultResponseDto[]> {
    const result = await this.service.findAll({
      filter: { trainingCampId: campId, testTypeId },
      limit: 10000,
      offset: 0,
    });
    return result.rows.map(({ result, testTypeIds }) =>
      ResultMapper.toDto(result, testTypeIds),
    );
  }

  // ============================================================
  // 4. УДАЛИТЬ ВСЕ РЕЗУЛЬТАТЫ ПОЛЬЗОВАТЕЛЯ В СБОРЕ ДЛЯ ТИПА
  // ============================================================
  @Delete('types/:testTypeId/training-camps/:campId/users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Delete all results for a user in a training camp for a specific test type',
  })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'campId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiNoContentResponse({ description: 'All results deleted successfully' })
  async deleteAllByUserAndCampAndTestType(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Param('campId', ParseUUIDPipe) campId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.service.deleteAllByUserAndCampAndTestType(
      userId,
      campId,
      testTypeId,
    );
  }

  // ============================================================
  // 5. ГЛОБАЛЬНЫЙ ПОИСК С ФИЛЬТРАЦИЕЙ И ПАГИНАЦИЕЙ
  // testTypeId — обязательный фильтр в пути.
  // ============================================================
  @Get('types/:testTypeId')
  @ApiOperation({
    summary:
      'Get all results with pagination, filtering, and sorting for a specific test type',
  })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'trainingCampId', required: false, type: String })
  @ApiQuery({
    name: 'isTen',
    required: false,
    type: Boolean,
    description: 'true – 10m sprint, false – main run',
  })
  @ApiQuery({ name: 'legNumber', required: false, type: Number, example: 1 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RESULT_STATUSES,
    description: 'Filter by result status',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['time', 'legNumber'],
    example: 'time',
  })
  @ApiQuery({
    name: 'orderDir',
    required: false,
    enum: ['ASC', 'DESC'],
    example: 'DESC',
  })
  @ApiResponse({
    status: 200,
    schema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: { $ref: '#/components/schemas/ResultResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  async findAll(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('userId') userId?: string,
    @Query('trainingCampId') trainingCampId?: string,
    @Query('isTen') isTen?: string,
    @Query('legNumber') legNumber?: string,
    @Query('status') status?: ResultStatus,
    @Query('orderBy') orderBy?: 'time' | 'legNumber',
    @Query('orderDir') orderDir?: 'ASC' | 'DESC',
  ): Promise<{ rows: ResultResponseDto[]; total: number }> {
    const filter: {
      userId?: string;
      trainingCampId?: string;
      isTen?: boolean;
      legNumber?: number;
      testTypeId: string;
      status?: ResultStatus;
    } = { testTypeId };
    if (userId) filter.userId = userId;
    if (trainingCampId) filter.trainingCampId = trainingCampId;
    if (isTen !== undefined) filter.isTen = isTen === 'true';
    if (legNumber) filter.legNumber = parseInt(legNumber, 10);
    if (status) filter.status = status;

    const result = await this.service.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      filter,
      orderBy,
      orderDir,
    });

    return {
      rows: result.rows.map(({ result, testTypeIds }) =>
        ResultMapper.toDto(result, testTypeIds),
      ),
      total: result.total,
    };
  }

  // ============================================================
  // 6. ПОЛУЧИТЬ ОДИН РЕЗУЛЬТАТ ПО СУРРОГАТНОМУ ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Get a result by surrogate ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: ResultResponseDto })
  @ApiNotFoundResponse({ description: 'Result not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResultResponseDto> {
    const entity = await this.service.findById(id);
    if (!entity) {
      throw new NotFoundException('Result not found');
    }
    return ResultMapper.toDto(entity.result, entity.testTypeIds);
  }

  // ============================================================
  // 7. ПОЛУЧИТЬ ВСЕ РЕЗУЛЬТАТЫ В СЛОТЕ (по составному ключу)
  //
  // В одном слоте (user, camp, is_10m, leg) может быть несколько
  // результатов — по одному на каждый уникальный набор
  // testTypeIds. Поэтому возвращается МАССИВ.
  // ============================================================
  @Get('composite/:userId/:campId/:isTen/:legNumber')
  @ApiOperation({
    summary: 'Get all results in a slot (by composite key)',
    description:
      'Returns all results in the slot (user, camp, is_10m, leg). ' +
      'A slot may contain multiple results — one per unique testTypeIds set.',
  })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'campId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'isTen', type: 'boolean' })
  @ApiParam({ name: 'legNumber', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'All results in the slot',
    type: [ResultResponseDto],
  })
  async findAllByComposite(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('campId', ParseUUIDPipe) campId: string,
    @Param('isTen') isTen: string,
    @Param('legNumber') legNumber: string,
  ): Promise<ResultResponseDto[]> {
    const entities = await this.service.findAllByComposite(
      userId,
      campId,
      isTen === 'true',
      parseInt(legNumber, 10),
    );
    return entities.map(({ result, testTypeIds }) =>
      ResultMapper.toDto(result, testTypeIds),
    );
  }

  // ============================================================
  // 8. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ ПО СУРРОГАТНОМУ ID
  //
  // 404 NotFound бросается из сервиса.
  // 400 BadRequest: status="completed" без единой метрики в итоге
  // (проверяется в сервисе после merge с текущим состоянием).
  //
  // Обновление возможно ТОЛЬКО по id: в одном слоте может быть
  // несколько результатов, и «обновить по (user, camp, is_10m, leg)»
  // неоднозначно.
  // ============================================================
  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a result by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateResultDto })
  @ApiResponse({ status: 200, type: ResultResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid input data. Например, status="not_admitted" при заполненных ' +
      'метриках или status="completed" без единой метрики.',
  })
  @ApiNotFoundResponse({ description: 'Result not found' })
  async updateById(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResultDto,
  ): Promise<ResultResponseDto> {
    const data = ResultMapper.toUpdateResultData(id, dto);
    const updated = await this.service.updateById(id, data);
    return ResultMapper.toDto(updated.result, updated.testTypeIds);
  }

  // ============================================================
  // 9. УДАЛИТЬ ОДИН РЕЗУЛЬТАТ ПО СУРРОГАТНОМУ ID
  //
  // 404 NotFound бросается из сервиса.
  // ============================================================
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a result by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Successfully deleted' })
  @ApiNotFoundResponse({ description: 'Result not found' })
  async removeById(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.deleteById(id);
  }

  // ============================================================
  // 10. УДАЛИТЬ ВСЕ РЕЗУЛЬТАТЫ В СЛОТЕ (по составному ключу)
  //
  // Удаляет ВСЕ результаты в слоте (user, camp, is_10m, leg) вместе
  // с их связями. Используется, когда нужно вычистить слот целиком,
  // независимо от того, сколько там результатов.
  //
  // 404 NotFound бросается из сервиса, если в слоте ничего не было.
  // ============================================================
  @Delete('composite/:userId/:campId/:isTen/:legNumber')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete all results in a slot (by composite key)',
    description:
      'Deletes ALL results in the slot (user, camp, is_10m, leg) ' +
      'along with their test type links.',
  })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'campId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'isTen', type: 'boolean' })
  @ApiParam({ name: 'legNumber', type: 'number' })
  @ApiNoContentResponse({ description: 'All results in slot deleted' })
  @ApiNotFoundResponse({ description: 'Slot has no results' })
  async removeAllByComposite(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('campId', ParseUUIDPipe) campId: string,
    @Param('isTen') isTen: string,
    @Param('legNumber') legNumber: string,
  ): Promise<void> {
    await this.service.deleteAllByComposite(
      userId,
      campId,
      isTen === 'true',
      parseInt(legNumber, 10),
    );
  }
}
