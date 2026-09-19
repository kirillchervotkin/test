import { scheduleValidationOptions } from './schedule-validation.js';
import {
  Controller,
  Get,
  Inject,
  Param,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { StandingsService } from './bracket-resolver.service.js';
import { StandingResponseDto } from './dto/standing-response.dto.js';
import { ScheduleMapper } from './mappers/schedule.mapper.js';
import * as T from './tokens.js';

@ApiTags('Таблицы групп')
@Controller()
@UsePipes(new ValidationPipe(scheduleValidationOptions))
export class StandingsController {
  constructor(
    @Inject(T.STANDINGS_SERVICE) private readonly service: StandingsService,
  ) {}
  @Get('stages/:stageId/standings')
  @ApiOperation({ summary: 'Рассчитать таблицу группы' })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiParam({
    name: 'stageId',
    type: String,
    description: 'Идентификатор Uint64',
  })
  @ApiOkResponse({
    description: 'Операция выполнена',
    type: [StandingResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Объект не найден' })
  @ApiBadRequestResponse({ description: 'Некорректные данные' })
  @ApiConflictResponse({ description: 'Конфликт состояния' })
  async calculate(@Param('stageId') stageId: string) {
    return this.service.calculate(await ScheduleMapper.id(stageId));
  }
}
