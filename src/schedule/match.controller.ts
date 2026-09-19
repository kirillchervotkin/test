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
import { CreateMatchDto } from './dto/create-match.dto.js';
import { MatchResponseDto } from './dto/match-response.dto.js';
import { UpdateMatchDto } from './dto/update-match.dto.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import { ScheduleMatchService } from './schedule-crud.service.js';
import * as T from './tokens.js';

@ApiTags('Матчи')
@Controller()
@UsePipes(new ValidationPipe(scheduleValidationOptions))
export class MatchController {
  constructor(
    @Inject(T.MATCHES_SERVICE) private readonly service: ScheduleMatchService,
  ) {}
  @Post('tournaments/:tournamentId/matches')
  @ApiOperation({ summary: 'Создать матч' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'tournamentId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiBody({ type: CreateMatchDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: MatchResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async create(
    @Param('tournamentId') tournamentId: string,
    @Body() data: CreateMatchDto,
  ) {
    return this.service.create(await ScheduleMapper.id(tournamentId), data);
  }

  @Get('tournaments/:tournamentId/matches')
  @ApiOperation({ summary: 'Матчи турнира' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'tournamentId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: [MatchResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async findAll(@Param('tournamentId') tournamentId: string) {
    return this.service.findAllByTournament(
      await ScheduleMapper.id(tournamentId),
    );
  }

  @Get('matches/:id')
  @ApiOperation({ summary: 'Операция с матчем' })
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

  @Put('matches/:id')
  @ApiOperation({ summary: 'Операция с матчем' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiBody({ type: UpdateMatchDto })
  @ApiOkResponse({ description: 'Операция выполнена' })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async update(@Param('id') id: string, @Body() data: UpdateMatchDto) {
    return this.service.update(await ScheduleMapper.id(id), data);
  }

  @Delete('matches/:id')
  @ApiOperation({ summary: 'Операция с матчем' })
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
