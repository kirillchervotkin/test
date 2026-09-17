import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ListService } from './list.service.js';
import { CreateListDto } from './dto/createList.dto.js';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiParam,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { List } from './list.types.js';

@ApiTags('lists')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('lists')
export class ListController {
  constructor(private readonly listService: ListService) {}

  @Post()
  @ApiOperation({ summary: 'Создание нового списка' })
  @ApiCreatedResponse({
    description: 'Список успешно создан',
    type: List,
  })
  @ApiBadRequestResponse({
    description: 'Невалидные данные',
  })
  @ApiConflictResponse({
    description: 'Список с таким именем уже существует',
  })
  @ApiBody({ type: CreateListDto })
  create(@Body() createListDto: CreateListDto) {
    return this.listService.createList(createListDto.name);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удаление списка по ID' })
  @ApiOkResponse({
    description: 'Список успешно удален',
  })
  @ApiNotFoundResponse({
    description: 'Список не найден',
  })
  @ApiBadRequestResponse({
    description: 'Невалидный ID',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID списка для удаления',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  delete(@Param('id') id: string) {
    return this.listService.deleteList(id);
  }

  @Get()
  @ApiOperation({ summary: 'Получение всех списков' })
  @ApiOkResponse({
    description: 'Списки успешно получены',
    type: [List],
  })
  getAll() {
    return this.listService.getAllLists();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получение списка по ID' })
  @ApiOkResponse({
    description: 'Список успешно получен',
    type: List,
  })
  @ApiNotFoundResponse({
    description: 'Список не найден',
  })
  @ApiBadRequestResponse({
    description: 'Невалидный ID',
  })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    description: 'UUID списка',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  getById(@Param('id') id: string) {
    return this.listService.getListById(id);
  }
}
