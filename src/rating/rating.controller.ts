import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
  ApiConflictResponse,
} from '@nestjs/swagger';

import { RATINGS_SERVICE } from './tokens.js';
import { CreateRatingDto } from './dto/createRating.dto.js';
import { RatingResponseDto } from './dto/ratingResponse.dto.js';
import type { RatingService } from './interfaces/ratingService.interface.js';
import { UpdateRatingDto } from './dto/updateRating.dto.js';

@ApiTags('Оценки')
@Controller()
export class RatingsController {
  constructor(
    @Inject(RATINGS_SERVICE)
    private readonly ratingsService: RatingService,
  ) {}

  @Post('assignments/:assignmentId/rating')
  @ApiOperation({
    summary: 'Создать оценку для назначения',
    description: 'Создает новую оценку для указанного назначения',
  })
  @ApiParam({
    name: 'assignmentId',
    description: 'ID назначения',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: CreateRatingDto })
  @ApiCreatedResponse({
    description: 'Оценка успешно создана',
    type: RatingResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  @ApiConflictResponse({
    description: 'Оценка для данного назначения уже существует',
  })
  @ApiNotFoundResponse({ description: 'Назначение не найдено' })
  create(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
    @Body() createRatingDto: CreateRatingDto,
  ): RatingResponseDto {
    return this.ratingsService.create(assignmentId, createRatingDto);
  }

  @Get('assignments/:assignmentId/rating')
  @ApiOperation({
    summary: 'Получить оценку по ID назначения',
  })
  @ApiParam({
    name: 'assignmentId',
    description: 'ID назначения',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Оценка получена успешно',
    type: RatingResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Оценка или назначение не найдены',
  })
  findByAssignmentId(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): RatingResponseDto {
    return this.ratingsService.findByAssignmentId(assignmentId);
  }

  @Delete('assignments/:assignmentId/rating')
  @ApiOperation({
    summary: 'Удалить оценку по ID назначения',
  })
  @ApiParam({
    name: 'assignmentId',
    description: 'ID назначения',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Оценка успешно удалена',
    schema: {
      example: { message: 'Оценка для назначения с ID 1 успешно удалена' },
    },
  })
  @ApiNotFoundResponse({ description: 'Оценка не найдена' })
  @HttpCode(HttpStatus.OK)
  removeByAssignmentId(
    @Param('assignmentId', ParseIntPipe) assignmentId: number,
  ): {
    message: string;
  } {
    return this.ratingsService.removeByAssignmentId(assignmentId);
  }

  @Put('ratings/:id')
  @ApiOperation({
    summary: 'Полностью обновить оценку',
    description:
      'Полностью заменяет существующую оценку по её ID. Все поля должны быть переданы (rating обязателен, comment может быть undefined)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID оценки',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: CreateRatingDto })
  @ApiOkResponse({
    description: 'Оценка успешно обновлена',
    type: RatingResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  @ApiNotFoundResponse({ description: 'Оценка не найдена' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() createRatingDto: CreateRatingDto,
  ): RatingResponseDto {
    return this.ratingsService.update(id, createRatingDto);
  }

  @Patch('ratings/:id')
  @ApiOperation({
    summary: 'Частично обновить оценку',
    description:
      'Частично обновляет существующую оценку по её ID. Обновляются только переданные поля',
  })
  @ApiParam({
    name: 'id',
    description: 'ID оценки',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateRatingDto })
  @ApiOkResponse({
    description: 'Оценка успешно обновлена',
    type: RatingResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  @ApiNotFoundResponse({ description: 'Оценка не найдена' })
  patch(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRatingDto: UpdateRatingDto,
  ): RatingResponseDto {
    return this.ratingsService.patch(id, updateRatingDto);
  }

  @Get('ratings/:id')
  @ApiOperation({
    summary: 'Получить оценку по ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID оценки',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Оценка получена успешно',
    type: RatingResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Оценка не найдена' })
  findOne(@Param('id', ParseIntPipe) id: number): RatingResponseDto {
    return this.ratingsService.findOne(id);
  }

  @Delete('ratings/:id')
  @ApiOperation({
    summary: 'Удалить оценку по ID',
  })
  @ApiParam({
    name: 'id',
    description: 'ID оценки',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Оценка успешно удалена',
    schema: {
      example: { message: 'Оценка с ID 1 успешно удалена' },
    },
  })
  @ApiNotFoundResponse({ description: 'Оценка не найдена' })
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number): {
    message: string;
  } {
    return this.ratingsService.remove(id);
  }

  @Get('ratings')
  @ApiOperation({
    summary: 'Получить все оценки',
    description: 'Возвращает список всех оценок в системе',
  })
  @ApiOkResponse({
    description: 'Список оценок получен успешно',
    type: [RatingResponseDto],
  })
  findAll(): RatingResponseDto[] {
    return this.ratingsService.findAll();
  }

  @Get('users/:userId/ratings')
  @ApiOperation({
    summary: 'Получить все оценки пользователя',
    description: 'Возвращает все оценки, поставленные указанному пользователю',
  })
  @ApiParam({
    name: 'userId',
    description: 'ID пользователя',
    type: Number,
    example: 101,
  })
  @ApiOkResponse({
    description: 'Список оценок пользователя получен успешно',
    type: [RatingResponseDto],
  })
  findAllByUserId(
    @Param('userId', ParseIntPipe) userId: number,
  ): RatingResponseDto[] {
    return this.ratingsService.findAllByUserId(userId);
  }

  @Get('matches/:matchId/ratings')
  @ApiOperation({
    summary: 'Получать все оценки для матча',
    description: 'Возвращает все оценки, связанные с указанным матчем',
  })
  @ApiParam({
    name: 'matchId',
    description: 'ID матча',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Список оценок для матча получен успешно',
    type: [RatingResponseDto],
  })
  findAllByMatchId(
    @Param('matchId', ParseIntPipe) matchId: number,
  ): RatingResponseDto[] {
    return this.ratingsService.findAllByMatchId(matchId);
  }
}
