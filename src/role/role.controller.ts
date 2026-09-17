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
import { CreateRoleDto } from './dto/createRole.dto.js';
import { RoleResponseDto } from './dto/roleResponse.dto.js';
import { UpdateRoleDto } from './dto/updateRole.dto.js';
import type { RoleService } from './interfaces/roleService.interface.js';
import { ROLE_SERVICE } from './tokens.js';

@ApiTags('Роли')
@Controller('roles')
export class RoleController {
  constructor(
    @Inject(ROLE_SERVICE)
    private readonly roleService: RoleService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создать новую роль' })
  @ApiBody({ type: CreateRoleDto })
  @ApiCreatedResponse({
    description: 'Роль успешно создана',
    type: RoleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  create(@Body() createRoleDto: CreateRoleDto): RoleResponseDto {
    return this.roleService.create(createRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всех ролей' })
  @ApiOkResponse({
    description: 'Список ролей получен успешно',
    type: [RoleResponseDto],
  })
  findAll(): RoleResponseDto[] {
    return this.roleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить информацию о конкретной роли' })
  @ApiParam({
    name: 'id',
    description: 'ID роли',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Информация о роли получена успешно',
    type: RoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Роль не найдена' })
  findOne(@Param('id', ParseIntPipe) id: number): RoleResponseDto {
    return this.roleService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить информацию о роли' })
  @ApiParam({
    name: 'id',
    description: 'ID роли',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateRoleDto })
  @ApiOkResponse({
    description: 'Роль успешно обновлена',
    type: RoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Роль не найдена' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
  ): RoleResponseDto {
    return this.roleService.update(id, updateRoleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить роль' })
  @ApiParam({
    name: 'id',
    description: 'ID роли',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Роль успешно удалена',
    schema: {
      example: { message: 'Роль с ID 1 успешно удалена' },
    },
  })
  @ApiNotFoundResponse({ description: 'Роль не найдена' })
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number): { message: string } {
    return this.roleService.remove(id);
  }
}
