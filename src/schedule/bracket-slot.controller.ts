import { scheduleValidationOptions } from './schedule-validation.js';
import {
  BadRequestException,
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
import {
  BracketResolverService,
  BracketSlotService,
} from './bracket-resolver.service.js';
import { BracketSlotResponseDto } from './dto/bracket-slot-response.dto.js';
import { CreateBracketSlotDto } from './dto/create-bracket-slot.dto.js';
import { OverrideBracketSlotDto } from './dto/override-bracket-slot.dto.js';
import { ResolveBracketDto } from './dto/resolve-bracket.dto.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import * as T from './tokens.js';

@ApiTags('Сетка плей-офф')
@Controller()
@UsePipes(new ValidationPipe(scheduleValidationOptions))
export class BracketSlotController {
  constructor(
    @Inject(T.BRACKET_SLOTS_SERVICE)
    private readonly service: BracketSlotService,
    @Inject(T.BRACKET_RESOLVER_SERVICE)
    private readonly resolver: BracketResolverService,
  ) {}
  @Post('bracket-slots')
  @ApiOperation({ summary: 'Создать правило заполнения слота' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiBody({ type: CreateBracketSlotDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: BracketSlotResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async create(@Body() data: CreateBracketSlotDto) {
    return this.service.create(data);
  }

  @Get('stages/:stageId/bracket-slots')
  @ApiOperation({ summary: 'Правила заполнения плей-офф' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'stageId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: [BracketSlotResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async findAll(@Param('stageId') stageId: string) {
    return this.service.findAll(await ScheduleMapper.id(stageId));
  }

  @Put('bracket-slots/:id')
  @ApiOperation({ summary: 'Назначить команду вручную' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({ name: 'id', type: String, description: 'Идентификатор Uint64' })
  @ApiBody({ type: OverrideBracketSlotDto })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: BracketSlotResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async override(
    @Param('id') id: string,
    @Body() data: OverrideBracketSlotDto,
  ) {
    return this.service.override(
      await ScheduleMapper.id(id),
      data.resolvedTeamId,
    );
  }

  @Delete('bracket-slots/:id')
  @ApiOperation({ summary: 'Удалить правило' })
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

  @Post('stages/:stageId/resolve')
  @ApiOperation({ summary: 'Заполнить слоты по результатам' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'stageId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiBody({ type: ResolveBracketDto })
  @ApiCreatedResponse({
    description: 'Операция выполнена',
    type: [BracketSlotResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async resolve(
    @Param('stageId') stageId: string,
    @Body() data: ResolveBracketDto = {},
  ) {
    if (data.stageId && data.stageId !== stageId)
      throw new BadRequestException('ID этапа в пути и теле различаются');
    return this.resolver.resolve(await ScheduleMapper.id(stageId));
  }
}
