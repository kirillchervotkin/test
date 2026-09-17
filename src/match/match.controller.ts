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
import { CreateMatchDto } from './dto/createMatch.dto.js';
import { MatchResponseDto } from './dto/matchResponse.dto.js';
import { UpdateMatchDto } from './dto/updateMatch.dto.js';
import { MATCHES_SERVICE } from './tokens.js';
import type { MatchService } from './interfaces/matchService.interface.js';

@ApiTags('Матчи')
@Controller()
export class MatchController {
  constructor(
    @Inject(MATCHES_SERVICE)
    private readonly matchesService: MatchService,
  ) {}

  @Post('tournaments/:tournamentId/matches')
  @ApiOperation({ summary: 'Добавить новый матч в турнир' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: CreateMatchDto })
  @ApiCreatedResponse({
    description: 'Матч успешно создан',
    type: MatchResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() createMatchDto: CreateMatchDto,
  ): MatchResponseDto {
    return this.matchesService.create(tournamentId, createMatchDto);
  }

  @Post('tournaments/:tournamentId/groups/:groupId/matches')
  @ApiOperation({
    summary: 'Добавить новый матч в определенную группу турнира',
  })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID группы',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: CreateMatchDto })
  @ApiCreatedResponse({
    description: 'Матч успешно создан в группе',
    type: MatchResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  @ApiNotFoundResponse({ description: 'Турнир или группа не найдены' })
  createInGroup(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() createMatchDto: CreateMatchDto,
  ): MatchResponseDto {
    return this.matchesService.create(tournamentId, createMatchDto, groupId);
  }

  @Get('tournaments/:tournamentId/matches')
  @ApiOperation({ summary: 'Получить все матчи турнира' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Список матчей турнира получен успешно',
    type: [MatchResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  findAllByTournament(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
  ): MatchResponseDto[] {
    return this.matchesService.findAllByTournament(tournamentId);
  }

  @Get('tournaments/:tournamentId/groups/:groupId/matches')
  @ApiOperation({ summary: 'Получить все матчи определенной группы турнира' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID группы',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Список матчей группы турнира получен успешно',
    type: [MatchResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Турнир или группа не найдены' })
  findAllByGroup(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
  ): MatchResponseDto[] {
    return this.matchesService.findAllByGroup(tournamentId, groupId);
  }

  @Get('matches/:id')
  @ApiOperation({ summary: 'Получить информацию о конкретном матче' })
  @ApiParam({
    name: 'id',
    description: 'ID матча',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Информация о матче получена успешно',
    type: MatchResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Матч не найден' })
  findOne(@Param('id', ParseIntPipe) id: number): MatchResponseDto {
    return this.matchesService.findOne(id);
  }

  @Put('matches/:id')
  @ApiOperation({ summary: 'Обновить информацию о матче' })
  @ApiParam({
    name: 'id',
    description: 'ID матча',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateMatchDto })
  @ApiOkResponse({
    description: 'Матч успешно обновлен',
    type: MatchResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Матч не найден' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMatchDto: UpdateMatchDto,
  ): MatchResponseDto {
    return this.matchesService.update(id, updateMatchDto);
  }

  @Delete('matches/:id')
  @ApiOperation({ summary: 'Удалить матч' })
  @ApiParam({
    name: 'id',
    description: 'ID матча',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Матч успешно удален',
    schema: {
      example: { message: 'Матч с ID 1 успешно удален' },
    },
  })
  @ApiNotFoundResponse({ description: 'Матч не найден' })
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number): { message: string } {
    return this.matchesService.remove(id);
  }

  @Delete('tournaments/:tournamentId/groups/:groupId/matches/:matchId')
  @ApiOperation({
    summary: 'Удалить матч из определенной группы турнира',
  })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID группы',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'matchId',
    description: 'ID матча',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Матч успешно удален из группы',
    schema: {
      example: {
        message: 'Матч с ID 1 успешно удален из турнира 1 и группы 1',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Матч, турнир или группа не найдены',
  })
  @HttpCode(HttpStatus.OK)
  removeFromGroup(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Param('matchId', ParseIntPipe) matchId: number,
  ): { message: string } {
    return this.matchesService.removeFromGroup(tournamentId, groupId, matchId);
  }

  @Delete('tournaments/:tournamentId/matches/:matchId')
  @ApiOperation({
    summary: 'Удалить матч из определенного турнира без учета группы',
  })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'matchId',
    description: 'ID матча',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Матч успешно удален из турнира',
    schema: {
      example: {
        message: 'Матч с ID 1 успешно удален из турнира 1',
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Матч или турнир не найдены',
  })
  @ApiBadRequestResponse({
    description: 'Матч не принадлежит указанному турниру',
  })
  @HttpCode(HttpStatus.OK)
  removeFromTournament(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('matchId', ParseIntPipe) matchId: number,
  ): { message: string } {
    return this.matchesService.removeFromTournament(tournamentId, matchId);
  }
}
