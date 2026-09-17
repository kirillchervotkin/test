// src/test-grades/test-grade.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { TestGradeService } from './test-grade.service.js';
import { CreateTestGradeDto } from './dto/create-test-grade.dto.js';
import { UpdateTestGradeDto } from './dto/update-test-grade.dto.js';
import { ApplyTestGradeDiffDto } from './dto/apply-test-grade-diff.dto.js';
import { TestGradeResponseDto } from './dto/test-grade-response.dto.js';
import { TestGradeMapper } from './mappers/test-grade.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

/**
 * Все маршруты вложены в ресурс типа теста:
 *   /test-types/:testTypeId/grades[/:gradeId]
 *
 * Градация — подресурс типа теста, а не самостоятельная сущность.
 * URL отражает это: без типа теста градация не существует.
 *
 * Проверка принадлежности градации типу теста — на уровне
 * репозитория (`WHERE id AND test_type_id`). Клиент не может
 * получить или изменить градацию чужого типа, даже если угадает id.
 */
@ApiTags('Градации тестов')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('test-types/:testTypeId/grades')
export class TestGradeController {
  constructor(private readonly service: TestGradeService) {}

  // ============================================================
  // 1. СОЗДАНИЕ ГРАДАЦИИ
  //
  // testTypeId берётся из URL — в теле не передаётся.
  // Репозиторий проверяет существование типа теста через
  // ensureTestTypeExists внутри транзакции.
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать градацию теста' })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiBody({ type: CreateTestGradeDto })
  @ApiCreatedResponse({
    description: 'Градация успешно создана',
    type: TestGradeResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiNotFoundResponse({ description: 'Тип теста не найден' })
  @ApiConflictResponse({
    description: 'Градация с таким названием уже существует для этого типа',
  })
  async create(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Body() dto: CreateTestGradeDto,
  ): Promise<TestGradeResponseDto> {
    const data = TestGradeMapper.toCreateData(testTypeId, dto);
    const entity = await this.service.create(data);
    return TestGradeMapper.toDto(entity);
  }

  // ============================================================
  // 2. ПОЛУЧИТЬ ВСЕ ГРАДАЦИИ ТИПА ТЕСТА
  //
  // Объявлено ДО @Get(':gradeId'), иначе 'types' попал бы в :id.
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить все градации типа теста',
    description:
      'Возвращает градации, отсортированные по threshold (естественный порядок отображения).',
  })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Список градаций',
    type: [TestGradeResponseDto],
  })
  async findAllByTestType(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
  ): Promise<TestGradeResponseDto[]> {
    const entities = await this.service.findAllByTestType(testTypeId);
    return TestGradeMapper.toDtoList(entities);
  }

  // ============================================================
  // 3. ПРИМЕНИТЬ DIFF К НАБОРУ ГРАДАЦИЙ
  //
  // Основная операция редактора набора: атомарно применяет
  // create / update / delete (порядок внутри: delete → update → create)
  // и возвращает актуальный набор целиком.
  // ============================================================
  @Patch()
  @ApiOperation({
    summary: 'Применить diff к набору градаций типа теста',
    description:
      'Атомарно применяет create / update / delete. ' +
      'Порядок внутри транзакции: delete → update → create. ' +
      'Возвращает актуальный набор целиком (с новыми id созданных).',
  })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiBody({ type: ApplyTestGradeDiffDto })
  @ApiResponse({
    status: 200,
    description: 'Актуальный набор градаций после применения diff',
    type: [TestGradeResponseDto],
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiNotFoundResponse({ description: 'Тип теста не найден' })
  @ApiConflictResponse({
    description: 'Конфликт уникальности по (test_type_id, grade)',
  })
  async applyDiff(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Body() dto: ApplyTestGradeDiffDto,
  ): Promise<TestGradeResponseDto[]> {
    const diff = TestGradeMapper.toDiff(dto);
    const entities = await this.service.applyDiff(testTypeId, diff);
    return TestGradeMapper.toDtoList(entities);
  }

  // ============================================================
  // 4. ПОЛУЧИТЬ ГРАДАЦИЮ ПО ID
  //
  // findByIdInType вернёт null, если градация не принадлежит
  // этому типу теста — контроллер отдаст 404.
  // ============================================================
  @Get(':gradeId')
  @ApiOperation({ summary: 'Получить градацию по ID' })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'gradeId', type: 'string', format: 'uuid' })
  @ApiResponse({
    status: 200,
    description: 'Найденная градация',
    type: TestGradeResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Градация не найдена или не принадлежит этому типу теста',
  })
  async findOne(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
  ): Promise<TestGradeResponseDto> {
    const entity = await this.service.findByIdInType(testTypeId, gradeId);
    if (!entity) {
      throw new NotFoundException('Градация не найдена');
    }
    return TestGradeMapper.toDto(entity);
  }

  // ============================================================
  // 5. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ ГРАДАЦИИ
  //
  // testTypeId не меняется: «переезд» градации в другой тип
  // теста — это delete + create.
  // ============================================================
  @Patch(':gradeId')
  @ApiOperation({ summary: 'Обновить градацию (частичное обновление)' })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'gradeId', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateTestGradeDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённая градация',
    type: TestGradeResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiNotFoundResponse({
    description: 'Градация не найдена или не принадлежит этому типу теста',
  })
  @ApiConflictResponse({
    description: 'Новое название уже занято в этом типе теста',
  })
  async update(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
    @Body() dto: UpdateTestGradeDto,
  ): Promise<TestGradeResponseDto> {
    const data = TestGradeMapper.toUpdateData(dto);
    const updated = await this.service.updateByIdInType(
      testTypeId,
      gradeId,
      data,
    );
    return TestGradeMapper.toDto(updated);
  }

  // ============================================================
  // 6. УДАЛЕНИЕ ГРАДАЦИИ
  // ============================================================
  @Delete(':gradeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить градацию' })
  @ApiParam({ name: 'testTypeId', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'gradeId', type: 'string', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Градация удалена' })
  @ApiNotFoundResponse({
    description: 'Градация не найдена или не принадлежит этому типу теста',
  })
  async remove(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Param('gradeId', ParseUUIDPipe) gradeId: string,
  ): Promise<void> {
    await this.service.deleteByIdInType(testTypeId, gradeId);
  }
}
