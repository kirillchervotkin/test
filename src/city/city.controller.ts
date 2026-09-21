// src/cities/city.controller.ts

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
import { CityService } from './city.service.js';
import { CreateCityDto } from './dto/createCity.dto.js';
import { UpdateCityDto } from './dto/updateCity.dto.js';
import { CityResponseDto } from './dto/cityResponse.dto.js';
import { FindCitiesQueryDto } from './dto/findCitiesQuery.dto.js';
import { CityMapper } from './mappers/city.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

/**
 * Города — глобальный справочник. Не привязан к турниру,
 * поэтому маршруты плоские: /cities[/:id].
 */
@ApiTags('Города')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('cities')
export class CityController {
  constructor(private readonly cityService: CityService) {}

  // ============================================================
  // 1. СОЗДАНИЕ ГОРОДА
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать новый город' })
  @ApiBody({ type: CreateCityDto })
  @ApiCreatedResponse({
    description: 'Город успешно создан',
    type: CityResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Город с таким названием уже существует',
  })
  async create(@Body() dto: CreateCityDto): Promise<CityResponseDto> {
    const data = CityMapper.toCreateData(dto);
    const entity = await this.cityService.create(data);
    return CityMapper.toDto(entity);
  }

  // ============================================================
  // 2. СПИСОК ГОРОДОВ
  //
  // Два режима через query:
  //   - ?search=мос    → частичный поиск по имени (автокомплит)
  //   - ?region=МО     → фильтр по региону
  //
  // Пагинации нет: городов в системе сотни максимум.
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить список городов с фильтрацией и сортировкой',
  })
  @ApiResponse({
    status: 200,
    description: 'Список городов',
    type: [CityResponseDto],
  })
  async findAll(
    @Query() query: FindCitiesQueryDto,
  ): Promise<CityResponseDto[]> {
    let entities;

    if (query.search) {
      // Автокомплит: частичное совпадение по имени.
      entities = await this.cityService.searchByName(query.search);
    } else {
      // Обычный список с фильтрами и сортировкой.
      entities = await this.cityService.findAll({
        filter: { region: query.region },
        orderBy: query.orderBy ?? 'name',
        orderDir: query.orderDir ?? 'ASC',
      });
    }

    return CityMapper.toDtoList(entities);
  }

  // ============================================================
  // 3. ПОЛУЧЕНИЕ ГОРОДА ПО ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Получить город по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID города',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденный город',
    type: CityResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Город не найден' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CityResponseDto> {
    const entity = await this.cityService.findById(id);
    if (!entity) {
      throw new NotFoundException('Город не найден');
    }
    return CityMapper.toDto(entity);
  }

  // ============================================================
  // 4. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ ГОРОДА
  //
  // `region: null` — допустимое значение для очистки региона.
  // ============================================================
  @Patch(':id')
  @ApiOperation({ summary: 'Обновить город (частичное обновление)' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID города',
  })
  @ApiBody({ type: UpdateCityDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённый город',
    type: CityResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Город не найден' })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Город с таким названием уже существует',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCityDto,
  ): Promise<CityResponseDto> {
    const data = CityMapper.toUpdateData(id, dto);
    const updated = await this.cityService.update(data);
    return CityMapper.toDto(updated);
  }

  // ============================================================
  // 5. УДАЛЕНИЕ ГОРОДА
  //
  // Пока простое удаление. Когда появится MatchRepository,
  // delete станет транзакционным и будет бросать
  // DbForeignKeyViolationException (409), если город используется
  // в матчах.
  // ============================================================
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить город' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID города',
  })
  @ApiNoContentResponse({ description: 'Город удалён' })
  @ApiNotFoundResponse({ description: 'Город не найден' })
  @ApiConflictResponse({
    description: 'Невозможно удалить город, так как он используется в матчах',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.cityService.delete(id);
  }
}
