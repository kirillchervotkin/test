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
import { StageTreeResponseDto } from './dto/calendar-response.dto.js';
import { CreateStageDto } from './dto/create-stage.dto.js';
import { StageResponseDto } from './dto/stage-response.dto.js';
import { UpdateStageDto } from './dto/update-stage.dto.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import { StageService } from './schedule-crud.service.js';
import * as T from './tokens.js';

@ApiTags('Этапы')
@Controller()
@UsePipes(new ValidationPipe(scheduleValidationOptions))
export class StageController {
  constructor(
    @Inject(T.STAGES_SERVICE) private readonly service: StageService,
  ) {}
  @Post('tournaments/:tournamentId/stages')
  @ApiOperation({ summary: 'Создать этап' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'tournamentId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiBody({ type: CreateStageDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: StageResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async create(
    @Param('tournamentId') tournamentId: string,
    @Body() data: CreateStageDto,
  ) {
    return this.service.create(await ScheduleMapper.id(tournamentId), data);
  }

  @Get('tournaments/:tournamentId/stages')
  @ApiOperation({ summary: 'Список этапов' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'tournamentId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: [StageResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async findAll(@Param('tournamentId') tournamentId: string) {
    return this.service.findAll(await ScheduleMapper.id(tournamentId));
  }

  @Get('tournaments/:tournamentId/stages/tree')
  @ApiOperation({ summary: 'Дерево этапов' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'tournamentId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: StageTreeResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async tree(@Param('tournamentId') tournamentId: string) {
    return this.service.tree(await ScheduleMapper.id(tournamentId));
  }

  @Get('stages/:id')
  @ApiOperation({ summary: 'Операция с этапом' })
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

  @Put('stages/:id')
  @ApiOperation({ summary: 'Операция с этапом' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiBody({ type: UpdateStageDto })
  @ApiOkResponse({ description: 'Операция выполнена' })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async update(@Param('id') id: string, @Body() data: UpdateStageDto) {
    return this.service.update(await ScheduleMapper.id(id), data);
  }

  @Delete('stages/:id')
  @ApiOperation({ summary: 'Операция с этапом' })
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
