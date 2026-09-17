// src/modules/fitness-report/fitness-report.controller.ts

import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { ReportService } from '../report/report.service.js';
import { FitnessReportResponseDto } from '../report/dto/fitnessReportResponse.dto.js';
import { GetFitnessReportQueryDto } from '../report/dto/getFitnessReportQuery.dto.js';
import { LatestUserAnthropometryResponseDto } from '../report/dto/latestUserAnthropometryResponse.dto.js';
import { UserAnthropometryQueryDto } from '../report/dto/userAnthropometryQuery.dto.js';
import { StandardsReportResponseDto } from './dto/standards-report-response.dto.js';
import { ReportMapper } from './report.mapper.js';

@ApiTags('Отчеты')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class FitnessReportController {
  constructor(private readonly reportService: ReportService) {}

  // ============================================================
  // 1. ФИТНЕС-ОТЧЕТ
  // ============================================================
  @Get('fitness')
  @ApiOperation({
    summary: 'Получить фитнес-отчет по пользователям',
    description:
      'Возвращает агрегированную статистику по тренировкам и кардионагрузкам для указанных пользователей за период',
  })
  @ApiResponse({
    status: 200,
    description: 'Успешный запрос',
    type: [FitnessReportResponseDto],
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    format: 'date-time',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: String,
    format: 'date-time',
    example: '2024-12-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'userIds',
    required: false,
    type: [String],
    format: 'uuid',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ],
  })
  async getFitnessReport(
    @Query() queryParams: GetFitnessReportQueryDto,
  ): Promise<FitnessReportResponseDto[]> {
    return await this.reportService.getFitnessReport(queryParams);
  }

  // ============================================================
  // 2. АНТРОПОМЕТРИЧЕСКИЙ ОТЧЕТ
  // ============================================================
  @Get('anthropometry')
  @ApiOperation({
    summary:
      'Возвращает список, содержащий последние антропометрические записи для всех пользователей. Для каждого пользователя в списке присутствует ровно одна запись — с самой поздней датой измерения.',
    description: `Возвращает список записей антропометрии с пагинацией и фильтрацией.`,
  })
  @ApiQuery({
    name: 'userIds',
    type: [String],
    format: 'uuid',
    required: false,
    description: 'Фильтр по идентификаторам пользователей',
    example: [
      '550e8400-e29b-41d4-a716-446655440000',
      '550e8400-e29b-41d4-a716-446655440001',
    ],
  })
  @ApiQuery({
    name: 'listIds',
    type: [String],
    format: 'uuid',
    required: false,
    description: 'Фильтр по идентификаторам списков',
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
  })
  @ApiResponse({
    status: 200,
    description: 'Список записей антропометрии',
    type: [LatestUserAnthropometryResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Не авторизован',
  })
  async latest(
    @Query() query: UserAnthropometryQueryDto,
  ): Promise<LatestUserAnthropometryResponseDto[]> {
    return this.reportService.getUsersReport(query);
  }

  // ============================================================
  // 3. ОТЧЕТ ПО НОРМАТИВАМ (testTypeId и listId в пути)
  // ============================================================
  @Get('standards/:testTypeId/lists/:listId')
  @ApiOperation({
    summary: 'Получить отчет по нормативам для пользователей из списка',
    description:
      'Возвращает для каждого пользователя из указанного списка его результаты по 3 попыткам (обычные и 10м) для заданного типа теста. ' +
      'Если trainingCampId не указан, используется активный сбор.',
  })
  @ApiParam({
    name: 'testTypeId',
    required: true,
    type: String,
    format: 'uuid',
    description: 'ID типа теста (UUID из таблицы test_types)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiParam({
    name: 'listId',
    required: true,
    type: String,
    format: 'uuid',
    description: 'ID списка пользователей',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiQuery({
    name: 'trainingCampId',
    required: false,
    type: String,
    format: 'uuid',
    description:
      'ID сбора (опционально). Если не указан, берётся активный сбор.',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Отчет по нормативам',
    type: [StandardsReportResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Не авторизован',
  })
  async getStandardsReport(
    @Param('testTypeId', ParseUUIDPipe) testTypeId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Query('trainingCampId', new ParseUUIDPipe({ optional: true }))
    trainingCampId?: string,
  ): Promise<StandardsReportResponseDto[]> {
    const rows = await this.reportService.getStandardsReport(
      listId,
      testTypeId,
      trainingCampId,
    );
    return ReportMapper.toStandardsDtoList(rows);
  }
}
