import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AnthropometryService } from './anthropometry.service.js';
import { CreateAnthropometricDataDto } from './dto/createAnthropometricData.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { GetAnthropometryQueryDto } from './dto/getAnthropometryQuery.dto.js';
import { AnthropometricDataResponseDto } from './dto/responses/anthropometricDataResponse.dto.js';

@ApiTags('Антропометрия')
@ApiBearerAuth('JWT-auth')
@Controller('users/:userId/anthropometry')
export class AnthropometryController {
  constructor(private readonly anthropometryService: AnthropometryService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({
    summary: 'Создание новой записи антропометрии',
    description: 'Создает новую запись антропометрических данных пользователя',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'ID пользователя',
  })
  @ApiBody({
    type: CreateAnthropometricDataDto,
    description: 'Данные для создания записи антропометрии',
  })
  @ApiResponse({
    status: 201,
    description: 'Запись антропометрии успешно создана',
    type: AnthropometricDataResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Неверные входные данные',
  })
  @ApiResponse({
    status: 401,
    description: 'Не авторизован',
  })
  create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() createDto: CreateAnthropometricDataDto,
  ) {
    return this.anthropometryService.create(userId, createDto);
  }

  @ApiOperation({ summary: 'Получение антропометрических данных пользователя' })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'ID пользователя',
  })
  @ApiQuery({
    type: GetAnthropometryQueryDto,
    description: 'Параметры запроса для фильтрации',
  })
  @ApiResponse({
    status: 200,
    description: 'Массив антропометрических данных для указанного пользователя',
    type: [AnthropometricDataResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  @Get()
  async getUserAnthropometry(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: GetAnthropometryQueryDto,
  ): Promise<AnthropometricDataResponseDto[]> {
    return await this.anthropometryService.findAllByUserId(userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @ApiOperation({
    summary: 'Удаление записи антропометрии',
    description: 'Удаляет запись антропометрии по указанному идентификатору',
  })
  @ApiParam({
    name: 'userId',
    type: Number,
    description: 'ID пользователя',
  })
  @ApiParam({
    name: 'AnthropometryId',
    type: Number,
    description: 'Идентификатор записи антропометрии для удаления',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Запись антропометрии успешно удалена',
  })
  @ApiResponse({
    status: 401,
    description: 'Не авторизован',
  })
  @ApiResponse({
    status: 404,
    description: 'Запись антропометрии не найдена',
  })
  remove(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('anthropometryId', ParseIntPipe) anthropometryId: number,
  ) {
    return this.anthropometryService.remove(userId, anthropometryId);
  }
}
