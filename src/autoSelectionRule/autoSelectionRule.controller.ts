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
import { CreateAutoSelectionRuleDto } from './dto/createAutoSelectionRule.dto.js';
import { AutoSelectionRuleResponseDto } from './dto/autoSelectionRuleResponse.dto.js';
import { UpdateAutoSelectionRuleDto } from './dto/updateAutoSelectionRule.dto.js';
import type { AutoSelectionRuleService } from './interfaces/autoSelectionRuleService.interface.js';
import { AUTO_SELECTION_RULE_SERVICE } from './tokens.js';

@ApiTags('Правила автоподбора')
@Controller('tournaments/:tournamentId/auto-selection-rules')
export class AutoSelectionRuleController {
  constructor(
    @Inject(AUTO_SELECTION_RULE_SERVICE)
    private readonly autoSelectionRuleService: AutoSelectionRuleService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создать новое правило автоподбора' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 5,
  })
  @ApiBody({ type: CreateAutoSelectionRuleDto })
  @ApiCreatedResponse({
    description: 'Правило успешно создано',
    type: AutoSelectionRuleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() createAutoSelectionRuleDto: CreateAutoSelectionRuleDto,
  ): AutoSelectionRuleResponseDto {
    return this.autoSelectionRuleService.create(
      tournamentId,
      createAutoSelectionRuleDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Получить все правила автоподбора для турнира' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 5,
  })
  @ApiOkResponse({
    description: 'Список правил получен успешно',
    type: [AutoSelectionRuleResponseDto],
  })
  findAll(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
  ): AutoSelectionRuleResponseDto[] {
    return this.autoSelectionRuleService.findAll(tournamentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить правило автоподбора по ID' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 5,
  })
  @ApiParam({
    name: 'id',
    description: 'ID правила',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Информация о правиле получена успешно',
    type: AutoSelectionRuleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Правило не найдено' })
  findOne(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ): AutoSelectionRuleResponseDto {
    return this.autoSelectionRuleService.findOne(tournamentId, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить правило автоподбора' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 5,
  })
  @ApiParam({
    name: 'id',
    description: 'ID правила',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateAutoSelectionRuleDto })
  @ApiOkResponse({
    description: 'Правило успешно обновлено',
    type: AutoSelectionRuleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Правило не найдено' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  update(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAutoSelectionRuleDto: UpdateAutoSelectionRuleDto,
  ): AutoSelectionRuleResponseDto {
    return this.autoSelectionRuleService.update(
      tournamentId,
      id,
      updateAutoSelectionRuleDto,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить правило автоподбора' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 5,
  })
  @ApiParam({
    name: 'id',
    description: 'ID правила',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Правило успешно удалено',
    schema: {
      example: { message: 'Правило автоподбора с ID 1 успешно удалено' },
    },
  })
  @ApiNotFoundResponse({ description: 'Правило не найдено' })
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('id', ParseIntPipe) id: number,
  ): { message: string } {
    return this.autoSelectionRuleService.remove(tournamentId, id);
  }
}
