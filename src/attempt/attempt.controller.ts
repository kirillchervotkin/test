// src/attempts/attempt.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
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
  ApiConflictResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { AttemptService } from './attempt.service.js';
import { CreateAttemptDto } from './dto/create-attempt.dto.js';
import { UpdateAttemptDto } from './dto/update-attempt.dto.js';
import { AttemptResponseDto } from './dto/response.dto.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { AttemptMapper } from './attempt.mapper.js';

@ApiTags('Попытки тестов')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('attempts')
export class AttemptController {
  constructor(private readonly attemptService: AttemptService) {}

  // ============================================================
  //  СОЗДАНИЕ ПОПЫТКИ
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать новую попытку теста' })
  @ApiCreatedResponse({
    description: 'Попытка успешно создана',
    type: AttemptResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description:
      'Такая комбинация (user_id, test_type, attempt_number, training_camp_id) уже существует',
  })
  async create(
    @Body() createDto: CreateAttemptDto,
  ): Promise<AttemptResponseDto> {
    const createData = AttemptMapper.toCreateAttemptData(createDto);
    const attempt = await this.attemptService.createAttempt(createData);
    return AttemptMapper.toDto(attempt);
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ СПИСКА ПОПЫТОК (ПАГИНАЦИЯ, ФИЛЬТРАЦИЯ, СОРТИРОВКА)
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить все попытки с пагинацией, фильтрацией и сортировкой',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Количество записей на страницу (по умолчанию 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Смещение (по умолчанию 0)',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Фильтр по идентификатору пользователя (точное совпадение)',
  })
  @ApiQuery({
    name: 'testType',
    required: false,
    type: String,
    description: 'Фильтр по типу теста (точное совпадение)',
  })
  @ApiQuery({
    name: 'trainingCampId',
    required: false,
    type: String,
    description:
      'Фильтр по идентификатору тренировочного лагеря (точное совпадение)',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['test_date', 'test_type', 'attempt_number'],
    description: 'Поле сортировки (по умолчанию test_date)',
  })
  @ApiQuery({
    name: 'orderDir',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Направление сортировки (по умолчанию DESC)',
  })
  @ApiResponse({
    status: 200,
    description: 'Список попыток',
    schema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: { $ref: '#/components/schemas/AttemptResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('userId') userId?: string,
    @Query('testType') testType?: string,
    @Query('trainingCampId') trainingCampId?: string,
    @Query('orderBy')
    orderBy?: 'test_date' | 'test_type' | 'attempt_number',
    @Query('orderDir') orderDir?: 'ASC' | 'DESC',
  ): Promise<{ rows: AttemptResponseDto[]; total: number }> {
    const result = await this.attemptService.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      filter: { userId, testType, trainingCampId },
      orderBy,
      orderDir,
    });

    return {
      rows: result.rows.map((attempt) => AttemptMapper.toDto(attempt)),
      total: result.total,
    };
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ ПОПЫТКИ ПО ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Получить попытку по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID попытки',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденная попытка',
    type: AttemptResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Попытка не найдена' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttemptResponseDto> {
    const attempt = await this.attemptService.findAttemptById(id);
    if (!attempt) {
      throw new NotFoundException('Попытка не найдена');
    }
    return AttemptMapper.toDto(attempt);
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ ПОПЫТКИ (частичное)
  // ============================================================
  @Put(':id')
  @ApiOperation({
    summary: 'Обновить данные попытки (частичное обновление)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID попытки',
  })
  @ApiBody({ type: UpdateAttemptDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённая попытка',
    type: AttemptResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Попытка не найдена' })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Конфликт уникальности при обновлении',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAttemptDto,
  ): Promise<AttemptResponseDto> {
    const updateData = AttemptMapper.toUpdateAttemptData(id, updateDto);
    const updated = await this.attemptService.updateAttempt(updateData);
    return AttemptMapper.toDto(updated);
  }

  // ============================================================
  //  УДАЛЕНИЕ ПОПЫТКИ
  // ============================================================
  @Delete(':id')
  @ApiOperation({ summary: 'Удалить попытку' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID попытки',
  })
  @ApiResponse({ status: 204, description: 'Попытка удалена' })
  @ApiNotFoundResponse({ description: 'Попытка не найдена' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.attemptService.deleteAttempt(id);
  }
}
