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
  Query,
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
import { CalendarResponseDto } from './dto/calendar-response.dto.js';
import { CreateTournamentDto } from './dto/create-tournament.dto.js';
import { FromTemplateDto } from './dto/from-template.dto.js';
import { GenerateScheduleDto } from './dto/generate-schedule.dto.js';
import { MatchResponseDto } from './dto/match-response.dto.js';
import { TournamentFilterDto } from './dto/tournament-filter.dto.js';
import { TournamentResponseDto } from './dto/tournament-response.dto.js';
import { UpdateTournamentDto } from './dto/update-tournament.dto.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import { ScheduleTournamentService } from './schedule-crud.service.js';
import { ScheduleGeneratorService } from './schedule-generator.service.js';
import * as T from './tokens.js';
import {
  CalendarService,
  TournamentFactoryService,
} from './tournament-factory.service.js';

@ApiTags('Турниры')
@Controller()
@UsePipes(new ValidationPipe(scheduleValidationOptions))
export class TournamentController {
  constructor(
    @Inject(T.TOURNAMENTS_SERVICE)
    private readonly service: ScheduleTournamentService,
    @Inject(T.TOURNAMENT_FACTORY_SERVICE)
    private readonly factory: TournamentFactoryService,
    @Inject(T.SCHEDULE_GENERATOR_SERVICE)
    private readonly generator: ScheduleGeneratorService,
    private readonly calendarService: CalendarService,
  ) {}
  @Post('tournaments')
  @ApiOperation({ summary: 'Создать турнир' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CreateTournamentDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: TournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async create(@Body() data: CreateTournamentDto) {
    return this.service.create(data);
  }

  @Get('tournaments')
  @ApiOperation({ summary: 'Список турниров' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: [TournamentResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async findAll(@Query() filter: TournamentFilterDto) {
    return this.service.findAll(filter);
  }

  @Post('tournaments/from-template')
  @ApiOperation({ summary: 'Создать турнир из шаблона' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: FromTemplateDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: TournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async fromTemplate(@Body() data: FromTemplateDto) {
    return this.factory.createFromTemplate(
      data.templateId,
      data.season,
      data.startDate,
      data.endDate,
    );
  }

  @Get('tournaments/:id')
  @ApiOperation({ summary: 'Детали турнира' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiOkResponse({ description: 'Операция выполнена' })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async findOne(@Param('id') id: string) {
    return this.service.findById(await ScheduleMapper.id(id));
  }

  @Put('tournaments/:id')
  @ApiOperation({ summary: 'Обновить турнир' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiBody({ type: UpdateTournamentDto })
  @ApiOkResponse({ description: 'Операция выполнена' })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async update(@Param('id') id: string, @Body() data: UpdateTournamentDto) {
    return this.service.update(await ScheduleMapper.id(id), data);
  }

  @Delete('tournaments/:id')
  @ApiOperation({ summary: 'Удалить турнир' })
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

  @Post('tournaments/:id/generate-schedule')
  @ApiOperation({ summary: 'Сгенерировать календарь' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiBody({ type: GenerateScheduleDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: [MatchResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async generate(@Param('id') id: string, @Body() data: GenerateScheduleDto) {
    return this.generator.generate(await ScheduleMapper.id(id), data);
  }

  @Get('tournaments/:id/calendar')
  @ApiOperation({ summary: 'Полный календарь турнира' })
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: CalendarResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async calendar(@Param('id') id: string) {
    return this.calendarService.calendar(await ScheduleMapper.id(id));
  }
}
