import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Inject,
  Patch,
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
import { CreateAssignmentDto } from './dto/createAssignment.dto.js';
import { AssignmentResponseDto } from './dto/assignmentResponse.dto.js';
import { ASSIGNMENTS_SERVICE } from './tokens.js';
import type { AssignmentService } from './interfaces/assignmentService.interface.js';
import { UpdateAssignmentDto } from './dto/updateAssignment.dto.js';

@ApiTags('Назначения')
@Controller()
export class AssignmentsController {
  constructor(
    @Inject(ASSIGNMENTS_SERVICE)
    private readonly assignmentsService: AssignmentService,
  ) {}

  @Post('matches/:id/assignments')
  @ApiOperation({
    summary: 'Назначить пользователя судьей на матч с определенной ролью',
  })
  @ApiParam({
    name: 'id',
    description: 'ID матча',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: CreateAssignmentDto })
  @ApiCreatedResponse({
    description: 'Пользователь успешно назначен на матч',
    type: AssignmentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  @ApiNotFoundResponse({
    description: 'Матч, пользователь или роль не найдены',
  })
  @ApiConflictResponse({
    description: 'Пользователь уже назначен на этот матч',
  })
  create(
    @Param('id', ParseIntPipe) matchId: number,
    @Body() createAssignmentDto: CreateAssignmentDto,
  ): AssignmentResponseDto {
    return this.assignmentsService.create(matchId, createAssignmentDto);
  }

  @Get('matches/:id/assignments')
  @ApiOperation({
    summary: 'Получить список всех официальных лиц, назначенных на матч',
  })
  @ApiParam({
    name: 'id',
    description: 'ID матча',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Список назначений на матч получен успешно',
    type: [AssignmentResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Матч не найден' })
  findAllByMatch(
    @Param('id', ParseIntPipe) matchId: number,
  ): AssignmentResponseDto[] {
    return this.assignmentsService.findAllByMatch(matchId);
  }

  @Delete('assignments/:id')
  @ApiOperation({
    summary: 'Отменить назначение (удалить судью из матча)',
  })
  @ApiParam({
    name: 'id',
    description: 'ID назначения',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Назначение успешно удалено',
    schema: {
      example: { message: 'Назначение с ID 1 успешно удалено' },
    },
  })
  @ApiNotFoundResponse({ description: 'Назначение не найдено' })
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number): { message: string } {
    return this.assignmentsService.remove(id);
  }

  @Patch('assignments/:id')
  @ApiOperation({
    summary: 'Обновить назначение судьи',
    description:
      'Позволяет заменить судью или изменить его роль в уже существующем назначении',
  })
  @ApiParam({
    name: 'id',
    description: 'ID назначения',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateAssignmentDto })
  @ApiOkResponse({
    description: 'Назначение успешно обновлено',
    type: AssignmentResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Назначение, пользователь или роль не найдены',
  })
  @ApiConflictResponse({
    description: 'Новый пользователь уже назначен на этот матч',
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAssignmentDto: UpdateAssignmentDto,
  ): AssignmentResponseDto {
    return this.assignmentsService.update(id, updateAssignmentDto);
  }
}
