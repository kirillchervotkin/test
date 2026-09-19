import { scheduleValidationOptions } from './schedule-validation.js';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { CreateTemplateDto } from './dto/create-template.dto.js';
import { TemplateResponseDto } from './dto/template-response.dto.js';
import { UpdateTemplateDto } from './dto/update-template.dto.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import { TemplateService } from './schedule-crud.service.js';
import * as T from './tokens.js';

@ApiTags('Шаблоны турниров')
@Controller()
@UsePipes(new ValidationPipe(scheduleValidationOptions))
export class TemplateController {
  constructor(
    @Inject(T.TEMPLATES_SERVICE) private readonly service: TemplateService,
  ) {}
  @Post('templates')
  @ApiOperation({ summary: 'Создать шаблон' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CreateTemplateDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: TemplateResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async create(@Body() data: CreateTemplateDto) {
    return this.service.create(data);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Список шаблонов' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: [TemplateResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async findAll() {
    return this.service.findAll();
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Операция с шаблоном' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiOkResponse({ description: 'Операция выполнена' })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(await ScheduleMapper.id(id));
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Операция с шаблоном' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiBody({ type: UpdateTemplateDto })
  @ApiOkResponse({ description: 'Операция выполнена' })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async update(@Param('id') id: string, @Body() data: UpdateTemplateDto) {
    return this.service.update(await ScheduleMapper.id(id), data);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Операция с шаблоном' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiOkResponse({ description: 'Операция выполнена' })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async remove(@Param('id') id: string) {
    return this.service.remove(await ScheduleMapper.id(id));
  }
}
