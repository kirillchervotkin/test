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
} from '@nestjs/swagger';
import { FIELD_ROLE_SERVICE } from './tokens.js';
import type { FieldRoleService } from './interfaces/fieldRoleService.interface.js';
import { FieldRoleResponseDto } from './dto/fieldRoleResponse.dto.js';
import { CreateFieldRoleDto } from './dto/createFieldRole.dto.js';
import { UpdateFieldRoleDto } from './dto/updateFieldRole.dto.js';

@ApiTags('Роли на футбольном поле')
@Controller('field-roles') // Изменено здесь: fieldRoles → field-roles
export class FieldRoleController {
  constructor(
    @Inject(FIELD_ROLE_SERVICE)
    private readonly fieldRoleService: FieldRoleService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создать новую роль на футбольном поле' })
  @ApiBody({ type: CreateFieldRoleDto })
  @ApiCreatedResponse({
    description: 'Роль на поле успешно создана',
    type: FieldRoleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  create(@Body() createFieldRoleDto: CreateFieldRoleDto): FieldRoleResponseDto {
    return this.fieldRoleService.create(createFieldRoleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всех ролей на футбольном поле' })
  @ApiOkResponse({
    description: 'Список ролей на поле получен успешно',
    type: [FieldRoleResponseDto],
  })
  findAll(): FieldRoleResponseDto[] {
    return this.fieldRoleService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить информацию о конкретной роли на поле' })
  @ApiParam({
    name: 'id',
    description: 'ID роли на поле',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Информация о роли на поле получена успешно',
    type: FieldRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Роль на поле не найдена' })
  findOne(@Param('id', ParseIntPipe) id: number): FieldRoleResponseDto {
    return this.fieldRoleService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить информацию о роли на поле' })
  @ApiParam({
    name: 'id',
    description: 'ID роли на поле',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateFieldRoleDto })
  @ApiOkResponse({
    description: 'Роль на поле успешно обновлена',
    type: FieldRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Роль на поле не найдена' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateFieldRoleDto: UpdateFieldRoleDto,
  ): FieldRoleResponseDto {
    return this.fieldRoleService.update(id, updateFieldRoleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить роль на поле' })
  @ApiParam({
    name: 'id',
    description: 'ID роли на поле',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Роль на поле успешно удалена',
    schema: {
      example: { message: 'Роль на поле с ID 1 успешно удалена' },
    },
  })
  @ApiNotFoundResponse({ description: 'Роль на поле не найдена' })
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number): { message: string } {
    return this.fieldRoleService.remove(id);
  }
}
