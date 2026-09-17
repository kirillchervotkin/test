// src/questionnaires/questionnaire.controller.ts

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
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { QuestionnaireService } from './questionnaire.service.js';
import { CreateQuestionnaireDto } from './dto/create-questionnaire.dto.js';
import { CreateManyByEmailDto } from './dto/create-many-by-email.dto.js';
import { UpdateQuestionnaireDto } from './dto/update-questionnaire.dto.js';
import { QuestionnaireResponseDto } from './dto/questionnaire-response.dto.js';
import { QuestionnaireBaseResponseDto } from './dto/questionnaire-base-response.dto.js';
import { GetQuestionnairesQueryDto } from './dto/get-questionnaires-query.dto.js';
import { QuestionnaireMapper } from './mappers/questionnaire.mapper.js';

@ApiTags('Анкеты пользователей')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('questionnaires')
export class QuestionnaireController {
  constructor(private readonly service: QuestionnaireService) {}

  // ============================================================
  // 1. СОЗДАНИЕ ИЛИ ЗАМЕНА АНКЕТЫ ПО USER ID (одиночный)
  // ============================================================
  @Post()
  @ApiOperation({
    summary: 'Создать или полностью заменить анкету по ID пользователя',
    description:
      'Если анкета для указанного пользователя уже существует, она будет полностью заменена переданными данными. ' +
      'Если не существует – будет создана новая.',
  })
  @ApiBody({ type: CreateQuestionnaireDto })
  @ApiCreatedResponse({
    description: 'Анкета успешно создана или обновлена',
    type: QuestionnaireBaseResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Некорректные входные данные' })
  async upsert(
    @Body() dto: CreateQuestionnaireDto,
  ): Promise<QuestionnaireBaseResponseDto> {
    const data = QuestionnaireMapper.toCreateData(dto);
    const entity = await this.service.upsert(data);
    return QuestionnaireMapper.toBaseDto(entity);
  }

  // ============================================================
  // 2. МАССОВОЕ СОЗДАНИЕ ИЛИ ЗАМЕНА АНКЕТ ПО EMAIL
  // ============================================================
  @Post('bulk')
  @ApiOperation({
    summary: 'Массовое создание или замена анкет по email пользователей',
    description:
      'Принимает массив объектов с email и данными анкеты. Все email проверяются на существование, ' +
      'затем выполняется массовый upsert анкет. Если какой-либо email не найден – операция прерывается.',
  })
  @ApiBody({ type: CreateManyByEmailDto })
  @ApiCreatedResponse({
    description: 'Анкеты успешно созданы или обновлены',
    type: [QuestionnaireBaseResponseDto],
  })
  @ApiBadRequestResponse({ description: 'Некорректные входные данные' })
  @ApiNotFoundResponse({
    description: 'Один или несколько пользователей не найдены',
  })
  async upsertBulkByEmail(
    @Body() dto: CreateManyByEmailDto,
  ): Promise<QuestionnaireBaseResponseDto[]> {
    const items = dto.items.map((item) => {
      const { email, ...rest } = item;
      return {
        email,
        ...QuestionnaireMapper.toCreateDataFromEmail(rest),
      };
    });
    const entities = await this.service.createManyByEmail(items);
    return QuestionnaireMapper.toBaseDtoArray(entities);
  }

  // ============================================================
  // 3. ПОЛУЧИТЬ СПИСОК АНКЕТ С ДАННЫМИ ПОЛЬЗОВАТЕЛЕЙ
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить список анкет с данными пользователей',
    description:
      'Поддерживает пагинацию и фильтрацию по спискам пользователей (listIds) и по конкретным пользователям (userIds). ' +
      'Возвращает анкеты с присоединёнными полями firstName, lastName, email.',
  })
  @ApiQuery({
    name: 'listIds',
    required: false,
    type: [String],
    description: 'Фильтр по UUID списков пользователей (массив)',
  })
  @ApiQuery({
    name: 'userIds',
    required: false,
    type: [String],
    description: 'Фильтр по UUID пользователей (массив)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiQuery({ name: 'offset', required: false, type: Number, example: 0 })
  @ApiResponse({
    status: 200,
    description: 'Список анкет',
    schema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: { $ref: '#/components/schemas/QuestionnaireResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  async findAll(
    @Query() query: GetQuestionnairesQueryDto,
  ): Promise<{ rows: QuestionnaireResponseDto[]; total: number }> {
    const result = await this.service.findAll({
      limit: query.limit,
      offset: query.offset,
      listIds: query.listIds,
      userIds: query.userIds,
    });
    return {
      rows: QuestionnaireMapper.toDtoArray(result.rows),
      total: result.total,
    };
  }

  // ============================================================
  // 4. ПОЛУЧИТЬ АНКЕТУ ПО USER ID С ДАННЫМИ ПОЛЬЗОВАТЕЛЯ
  // ============================================================
  @Get(':userId')
  @ApiOperation({
    summary: 'Получить анкету по ID пользователя с данными пользователя',
  })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: QuestionnaireResponseDto })
  @ApiNotFoundResponse({ description: 'Анкета не найдена' })
  async findByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<QuestionnaireResponseDto> {
    const entity = await this.service.findWithUserByUserId(userId);
    if (!entity) {
      throw new NotFoundException(
        `Анкета для пользователя ${userId} не найдена`,
      );
    }
    return QuestionnaireMapper.toDto(entity);
  }

  // ============================================================
  // 5. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ АНКЕТЫ ПО USER ID
  // ============================================================
  @Patch(':userId')
  @ApiOperation({
    summary: 'Частичное обновление анкеты по ID пользователя',
    description:
      'Обновляет только те поля, которые переданы в теле запроса. Остальные поля остаются без изменений.',
  })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiBody({ type: UpdateQuestionnaireDto })
  @ApiResponse({ status: 200, type: QuestionnaireBaseResponseDto })
  @ApiNotFoundResponse({ description: 'Анкета не найдена' })
  @ApiBadRequestResponse({ description: 'Некорректные входные данные' })
  async update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateQuestionnaireDto,
  ): Promise<QuestionnaireBaseResponseDto> {
    const data = QuestionnaireMapper.toUpdateData(userId, dto);
    const updated = await this.service.update(userId, data);
    return QuestionnaireMapper.toBaseDto(updated);
  }

  // ============================================================
  // 6. УДАЛЕНИЕ АНКЕТЫ ПО USER ID
  // ============================================================
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить анкету по ID пользователя' })
  @ApiParam({ name: 'userId', type: 'string', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Анкета успешно удалена' })
  @ApiNotFoundResponse({ description: 'Анкета не найдена' })
  async remove(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    await this.service.delete(userId);
  }
}
