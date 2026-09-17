// src/modules/training-camps/training-camp.controller.ts

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
import { TrainingCampService } from './training-camp.service.js';
import { CreateTrainingCampDto } from './dto/create-training-camp.dto.js';
import { UpdateTrainingCampDto } from './dto/update-training-camp.dto.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { TrainingCampMapper } from './mappers/training-camp.mapper.js';
import { TrainingCampResponseDto } from './dto/response.dto.js';

@ApiTags('Тренировочные лагеря')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('training-camps')
export class TrainingCampController {
  constructor(private readonly campService: TrainingCampService) {}

  // ============================================================
  //  СОЗДАНИЕ ЛАГЕРЯ
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать новый тренировочный лагерь' })
  @ApiCreatedResponse({
    description: 'Лагерь успешно создан',
    type: TrainingCampResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Лагерь с таким названием уже существует',
  })
  async create(
    @Body() createDto: CreateTrainingCampDto,
  ): Promise<TrainingCampResponseDto> {
    const createData = TrainingCampMapper.toCreateTrainingCampData(createDto);
    const camp = await this.campService.createCamp(createData);
    return TrainingCampMapper.toDto(camp);
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ СПИСКА ЛАГЕРЕЙ (ПАГИНАЦИЯ, ФИЛЬТРАЦИЯ)
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить все тренировочные лагеря с пагинацией и фильтрацией',
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
    name: 'location',
    required: false,
    type: String,
    description: 'Фильтр по локации (частичное совпадение)',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['start_date', 'end_date', 'name'],
    description: 'Поле сортировки',
  })
  @ApiQuery({
    name: 'orderDir',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Направление сортировки',
  })
  @ApiResponse({
    status: 200,
    description: 'Список лагерей',
    schema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: { $ref: '#/components/schemas/TrainingCampResponseDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('name') name?: string,
    @Query('location') location?: string,
    @Query('orderBy')
    orderBy?: 'start_date' | 'end_date' | 'name',
    @Query('orderDir') orderDir?: 'ASC' | 'DESC',
  ): Promise<{ rows: TrainingCampResponseDto[]; total: number }> {
    const result = await this.campService.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      filter: { name, location },
      orderBy,
      orderDir,
    });

    return {
      rows: result.rows.map((camp) => TrainingCampMapper.toDto(camp)),
      total: result.total,
    };
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ ЛАГЕРЯ ПО ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Получить тренировочный лагерь по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID лагеря',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденный лагерь',
    type: TrainingCampResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Лагерь не найден' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TrainingCampResponseDto> {
    const camp = await this.campService.findCampById(id);
    if (!camp) {
      throw new NotFoundException('Тренировочный лагерь не найден');
    }
    return TrainingCampMapper.toDto(camp);
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ ЛАГЕРЯ (частичное)
  // ============================================================
  @Put(':id')
  @ApiOperation({
    summary: 'Обновить данные тренировочного лагеря (частичное обновление)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID лагеря',
  })
  @ApiBody({ type: UpdateTrainingCampDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённый лагерь',
    type: TrainingCampResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Лагерь не найден' })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Название уже используется другим лагерем',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTrainingCampDto,
  ): Promise<TrainingCampResponseDto> {
    const updateData = TrainingCampMapper.toUpdateTrainingCampData(
      id,
      updateDto,
    );
    const updated = await this.campService.updateCamp(updateData);
    // Сервис бросает NotFoundException, но для единообразия можно оставить проверку
    return TrainingCampMapper.toDto(updated);
  }

  // ============================================================
  //  УДАЛЕНИЕ ЛАГЕРЯ
  // ============================================================
  @Delete(':id')
  @ApiOperation({ summary: 'Удалить тренировочный лагерь' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID лагеря',
  })
  @ApiResponse({ status: 204, description: 'Лагерь удалён' })
  @ApiNotFoundResponse({ description: 'Лагерь не найден' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.campService.deleteCamp(id);
  }
}
