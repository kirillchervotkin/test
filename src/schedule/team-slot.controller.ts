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
import { AssignTeamSlotDto } from './dto/assign-team-slot.dto.js';
import { CreateTeamSlotDto } from './dto/create-team-slot.dto.js';
import { TeamSlotResponseDto } from './dto/team-slot-response.dto.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import { TeamSlotService } from './schedule-crud.service.js';
import * as T from './tokens.js';

@ApiTags('Слоты команд')
@Controller()
@UsePipes(new ValidationPipe(scheduleValidationOptions))
export class TeamSlotController {
  constructor(
    @Inject(T.TEAM_SLOTS_SERVICE) private readonly service: TeamSlotService,
  ) {}
  @Post('tournaments/:tournamentId/team-slots')
  @ApiOperation({ summary: 'Создать слот команды' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'tournamentId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiBody({ type: CreateTeamSlotDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: TeamSlotResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async create(
    @Param('tournamentId') tournamentId: string,
    @Body() data: CreateTeamSlotDto,
  ) {
    return this.service.create(await ScheduleMapper.id(tournamentId), data);
  }

  @Get('tournaments/:tournamentId/team-slots')
  @ApiOperation({ summary: 'Слоты турнира' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'tournamentId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: [TeamSlotResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async findAll(@Param('tournamentId') tournamentId: string) {
    return this.service.findAll(await ScheduleMapper.id(tournamentId));
  }

  @Put('team-slots/:id')
  @ApiOperation({ summary: 'Назначить команду слоту' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiBody({ type: AssignTeamSlotDto })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: TeamSlotResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async assign(@Param('id') id: string, @Body() data: AssignTeamSlotDto) {
    return this.service.assign(await ScheduleMapper.id(id), data.teamId);
  }

  @Delete('team-slots/:id')
  @ApiOperation({ summary: 'Удалить слот' })
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
