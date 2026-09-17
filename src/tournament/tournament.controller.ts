import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { CreateTournamentDto } from './dto/createTournament.dto.js';
import { TournamentResponseDto } from './dto/tournamentResponse.dto.js';
import { UpdateTournamentDto } from './dto/updateTournament.dto.js';
import { TOURNAMENTS_SERVICE } from './tokens.js';
import type { TournamentsService } from './interfaces/tournamentService.interface.js';

@ApiTags('Турниры')
@Controller('tournaments')
export class TournamentController {
  constructor(
    @Inject(TOURNAMENTS_SERVICE)
    private readonly tournamentsService: TournamentsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создать новый турнир' })
  @ApiBody({ type: CreateTournamentDto })
  @ApiCreatedResponse({
    description: 'Турнир успешно создан',
    type: TournamentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  async create(
    @Body() createTournamentDto: CreateTournamentDto,
  ): Promise<TournamentResponseDto> {
    return await this.tournamentsService.create(createTournamentDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всех турниров' })
  @ApiOkResponse({
    description: 'Список турниров получен успешно',
    type: [TournamentResponseDto],
  })
  async findAll(): Promise<TournamentResponseDto[]> {
    return await this.tournamentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить информацию о конкретном турнире' })
  @ApiParam({
    name: 'id',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Информация о турнире получена успешно',
    type: TournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TournamentResponseDto | null> {
    const response: TournamentResponseDto | null =
      await this.tournamentsService.findById(id);
    if (!response) {
      throw new NotFoundException(`Tournament with id = ${id} not found`);
    }
    return response;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить информацию о турнире' })
  @ApiParam({
    name: 'id',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateTournamentDto })
  @ApiOkResponse({
    description: 'Турнир успешно обновлен',
    type: TournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTournamentDto: UpdateTournamentDto,
  ): Promise<TournamentResponseDto> {
    return await this.tournamentsService.update(id, updateTournamentDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить турнир' })
  @ApiParam({
    name: 'id',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Турнир успешно удален',
  })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return await this.tournamentsService.remove(id);
  }
}
