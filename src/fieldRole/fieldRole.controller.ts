// src/field-roles/field-role.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { FIELD_ROLES_SERVICE } from './tokens.js';
import type { FieldRoleService } from './fieldRole.service.js';
import { CreateFieldRoleDto } from './dto/createFieldRole.dto.js';
import { UpdateFieldRoleDto } from './dto/updateFieldRole.dto.js';
import { FieldRoleResponseDto } from './dto/fieldRoleResponse.dto.js';
import { FindFieldRolesQueryDto } from './dto/findFieldRolesQuery.dto.js';
import { FieldRoleMapper } from './mappers/field-role.mapper.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

/**
 * Роли на поле — глобальный справочник. Не привязан к турниру,
 * поэтому маршруты плоские: /field-roles[/:id].
 *
 * Справочник фиксированный (5 ролей: REFEREE, ASSISTANT, RESERVE,
 * VAR, AVAR). Обычно заполняется сид-данными при деплое. CRUD
 * оставлен на случай, если понадобится добавить или отредактировать
 * роль через админку.
 *
 * Локализация: `code` — ключ для перевода на фронте, `name` —
 * русский fallback.
 */
@ApiTags('Роли на поле')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('field-roles')
export class FieldRoleController {
  constructor(
    @Inject(FIELD_ROLES_SERVICE)
    private readonly fieldRoleService: FieldRoleService,
  ) {}

  // ============================================================
  // 1. СОЗДАНИЕ РОЛИ
  //
  // Все поля обязательны. При нарушении уникальности `code` —
  // 409 через DbUniqueViolationException.
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создать роль на поле' })
  @ApiBody({ type: CreateFieldRoleDto })
  @ApiCreatedResponse({
    description: 'Роль успешно создана',
    type: FieldRoleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Роль с таким кодом уже существует',
  })
  async create(@Body() dto: CreateFieldRoleDto): Promise<FieldRoleResponseDto> {
    const data = FieldRoleMapper.toCreateData(dto);
    const entity = await this.fieldRoleService.create(data);
    return FieldRoleMapper.toDto(entity);
  }

  // ============================================================
  // 2. СПИСОК РОЛЕЙ
  //
  // Без query — все роли, отсортированные по sortOrder
  // (естественный порядок UI: Главный судья, Помощник, ...).
  //
  // Фильтры:
  //   - ?code=REFEREE  → точное совпадение
  //   - ?name=судья    → частичное совпадение
  //
  // Пагинации нет: ролей фиксированное количество (5).
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить список ролей на поле',
    description:
      'Без query — все роли, отсортированные по sortOrder. ' +
      'Фильтры: code (точное), name (частичное). ' +
      'Пагинации нет.',
  })
  @ApiResponse({
    status: 200,
    description: 'Список ролей',
    type: [FieldRoleResponseDto],
  })
  async findAll(
    @Query() query: FindFieldRolesQueryDto,
  ): Promise<FieldRoleResponseDto[]> {
    const entities = await this.fieldRoleService.findAll({
      filter: { code: query.code, name: query.name },
      orderBy: query.orderBy ?? 'sortOrder',
      orderDir: query.orderDir ?? 'ASC',
    });
    return FieldRoleMapper.toDtoList(entities);
  }

  // ============================================================
  // 3. ПОЛУЧЕНИЕ РОЛИ ПО ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Получить роль по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID роли',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденная роль',
    type: FieldRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Роль не найдена' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FieldRoleResponseDto> {
    const entity = await this.fieldRoleService.findById(id);
    if (!entity) {
      throw new NotFoundException('Роль не найдена');
    }
    return FieldRoleMapper.toDto(entity);
  }

  // ============================================================
  // 4. ЧАСТИЧНОЕ ОБНОВЛЕНИЕ РОЛИ
  //
  // `null` не допускается: у роли нет nullable-полей. Только
  // `undefined` (не трогать) или значение (заменить).
  //
  // `code` можно менять, но осторожно: он используется в
  // бизнес-логике и как ключ локализации. При конфликте —
  // 409 через DbUniqueViolationException.
  // ============================================================
  @Patch(':id')
  @ApiOperation({ summary: 'Обновить роль (частичное обновление)' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID роли',
  })
  @ApiBody({ type: UpdateFieldRoleDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённая роль',
    type: FieldRoleResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Роль не найдена' })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Роль с таким кодом уже существует',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFieldRoleDto,
  ): Promise<FieldRoleResponseDto> {
    const data = FieldRoleMapper.toUpdateData(id, dto);
    const updated = await this.fieldRoleService.update(data);
    return FieldRoleMapper.toDto(updated);
  }

  // ============================================================
  // 5. УДАЛЕНИЕ РОЛИ
  //
  // Пока простое удаление. Когда появится AssignmentRepository,
  // delete станет транзакционным и будет бросать 409, если
  // на роль есть назначения.
  // ============================================================
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить роль' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID роли',
  })
  @ApiNoContentResponse({ description: 'Роль удалена' })
  @ApiNotFoundResponse({ description: 'Роль не найдена' })
  @ApiConflictResponse({
    description: 'Невозможно удалить роль, так как на неё есть назначения',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.fieldRoleService.delete(id);
  }
}
