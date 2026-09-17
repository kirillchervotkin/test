// src/modules/test-types/test-type.controller.ts

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
import { TestTypeService } from './test-type.service.js';
import { CreateTestTypeDto } from './dto/create-test-type.dto.js';
import { UpdateTestTypeDto } from './dto/update-test-type.dto.js';
import { TestTypeResponseDto } from './dto/response.dto.js';
import { PaginatedTestTypeResponseDto } from './dto/paginated-response.dto.js';
import { TestTypeMapper } from './mappers/test-type.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

@ApiTags('Типы тестов')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('test-types')
export class TestTypeController {
  constructor(private readonly testTypeService: TestTypeService) {}

  // ============================================================
  //  СОЗДАНИЕ ТИПА ТЕСТА
  //
  //  `parameter` клиент не передаёт — он выводится из комбинации
  //  failThreshold* в TestTypeMapper.toCreateData.
  //  `attemptsCount` валидируется в CreateTestTypeDto (обязателен
  //  для time-тестов, запрещён для остальных).
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать новый тип теста' })
  @ApiCreatedResponse({
    description: 'Тип теста успешно создан',
    type: TestTypeResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Тип теста с таким названием уже существует',
  })
  async create(
    @Body() createDto: CreateTestTypeDto,
  ): Promise<TestTypeResponseDto> {
    const createData = TestTypeMapper.toCreateData(createDto);
    const entity = await this.testTypeService.create(createData);
    return TestTypeMapper.toDto(entity);
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ СПИСКА ТИПОВ ТЕСТОВ
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить все типы тестов с пагинацией, фильтрацией и сортировкой',
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
    name: 'name',
    required: false,
    type: String,
    description: 'Фильтр по названию (частичное совпадение)',
  })
  @ApiQuery({
    name: 'gender',
    required: false,
    enum: ['male', 'female'],
    description: 'Фильтр по полу',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['name', 'id', 'gender'],
    description: 'Поле сортировки (по умолчанию name)',
  })
  @ApiQuery({
    name: 'orderDir',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Направление сортировки (по умолчанию ASC)',
  })
  @ApiResponse({
    status: 200,
    description: 'Список типов тестов',
    type: PaginatedTestTypeResponseDto,
  })
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('name') name?: string,
    @Query('gender') gender?: string,
    @Query('orderBy') orderBy?: 'name' | 'id' | 'gender',
    @Query('orderDir') orderDir?: 'ASC' | 'DESC',
  ): Promise<PaginatedTestTypeResponseDto> {
    const result = await this.testTypeService.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      filter: { name, gender },
      orderBy: orderBy ?? 'name',
      orderDir: orderDir ?? 'ASC',
    });

    return {
      rows: TestTypeMapper.toDtoList(result.rows),
      total: result.total,
    };
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ ТИПА ТЕСТА ПО ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Получить тип теста по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID типа теста',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденный тип теста',
    type: TestTypeResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Тип теста не найден' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TestTypeResponseDto> {
    const entity = await this.testTypeService.findById(id);
    if (!entity) {
      throw new NotFoundException('Тип теста не найден');
    }
    return TestTypeMapper.toDto(entity);
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ ТИПА ТЕСТА (частичное)
  //
  //  Метод PATCH — семантика частичного обновления. Ранее был PUT,
  //  что было не совсем корректно: клиент может прислать только
  //  часть полей.
  //
  //  id берётся из path, а не из тела (см. TestTypeMapper.toUpdateData):
  //  поле id в UpdateTestTypeDto игнорируется.
  //
  //  Инвариант `parameter` ↔ `attemptsCount` проверяется в сервисе
  //  (нужно текущее состояние сущности), поэтому в ответе возможен
  //  400, даже если DTO сам по себе валиден.
  // ============================================================
  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить тип теста (частичное обновление)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID типа теста',
  })
  @ApiBody({ type: UpdateTestTypeDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённый тип теста',
    type: TestTypeResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Тип теста не найден' })
  @ApiBadRequestResponse({
    description:
      'Неверные данные. Например, attemptsCount передан для не-time ' +
      'теста или не передан для time-теста.',
  })
  @ApiConflictResponse({
    description: 'Название уже используется другим типом',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTestTypeDto,
  ): Promise<TestTypeResponseDto> {
    const updateData = TestTypeMapper.toUpdateData(id, updateDto);
    const updated = await this.testTypeService.update(updateData);
    return TestTypeMapper.toDto(updated);
  }

  // ============================================================
  //  УДАЛЕНИЕ ТИПА ТЕСТА
  // ============================================================
  @Delete(':id')
  @ApiOperation({ summary: 'Удалить тип теста' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID типа теста',
  })
  @ApiResponse({ status: 204, description: 'Тип теста удалён' })
  @ApiNotFoundResponse({ description: 'Тип теста не найден' })
  @ApiConflictResponse({
    description:
      'Невозможно удалить тип, так как на него есть ссылки в результатах',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.testTypeService.delete(id);
  }
}
