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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { LIST_ROLE_SERVICE } from './tokents.js';
import type { ListRoleService } from './interfaces/listRoleService.interface.js';
import { CreateListRoleDto } from './dto/createListRole.dto.js';
import { ListRoleResponseDto } from './dto/listRoleResponse.dto.js';

@ApiTags('Роли списков')
@Controller('lists/:listId/roles')
export class ListRoleController {
  constructor(
    @Inject(LIST_ROLE_SERVICE)
    private readonly listRoleService: ListRoleService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Добавить роль к списку' })
  @ApiParam({
    name: 'listId',
    description: 'ID списка',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: CreateListRoleDto })
  @ApiCreatedResponse({
    description: 'Роль успешно добавлена к списку',
    type: ListRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Список или роль не найдены' })
  @ApiConflictResponse({ description: 'Роль уже добавлена к списку' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  addRoleToList(
    @Param('listId', ParseIntPipe) listId: number,
    @Body() createListRoleDto: CreateListRoleDto,
  ): ListRoleResponseDto {
    return this.listRoleService.addRoleToList(listId, createListRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить все роли списка' })
  @ApiParam({
    name: 'listId',
    description: 'ID списка',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Список ролей получен успешно',
    type: [ListRoleResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Список не найден' })
  getListRoles(
    @Param('listId', ParseIntPipe) listId: number,
  ): ListRoleResponseDto[] {
    return this.listRoleService.getListRoles(listId);
  }

  @Delete(':roleId')
  @ApiOperation({ summary: 'Удалить роль из списка' })
  @ApiParam({
    name: 'listId',
    description: 'ID списка',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'roleId',
    description: 'ID роли',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Роль успешно удалена из списка',
    schema: {
      example: { message: 'Роль с ID 1 успешно удалена из списка с ID 1' },
    },
  })
  @ApiNotFoundResponse({ description: 'Список или роль не найдены' })
  @HttpCode(HttpStatus.OK)
  removeRoleFromList(
    @Param('listId', ParseIntPipe) listId: number,
    @Param('roleId', ParseIntPipe) roleId: number,
  ): { message: string } {
    return this.listRoleService.removeRoleFromList(listId, roleId);
  }
}
