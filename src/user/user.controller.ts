// src/modules/users/user.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { UserService } from './user.service.js';
import { CreateUserDto } from './dto/createUserWithotPassword.dto.js'; // убедитесь, что путь корректен
import { UpdateUserDto } from './dto/updateUser.dto.js';
import { UserWithoutExcludedDto } from './dto/userWithoutExcluded.dto.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { UserMapper } from './user.mapper.js';

@ApiTags('Пользователи')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ============================================================
  //  СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ (БЕЗ ПАРОЛЯ)
  // ============================================================
  @Post()
  @ApiOperation({ summary: 'Создание нового пользователя (без пароля)' })
  @ApiCreatedResponse({
    description: 'Пользователь успешно создан',
    type: UserWithoutExcludedDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Пользователь с таким email уже существует',
  })
  async createUser(
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserWithoutExcludedDto> {
    // Преобразуем DTO в данные для создания
    const createData = UserMapper.toCreateUserData(createUserDto);
    // Вызываем сервис (без пароля)
    const user = await this.userService.createUser(createData);
    // Преобразуем результат в DTO ответа
    return UserMapper.toDto(user);
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ (ПАГИНАЦИЯ, ФИЛЬТРАЦИЯ)
  // ============================================================
  @Get()
  @ApiOperation({
    summary: 'Получить всех пользователей с пагинацией и фильтрацией',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Количество записей на страницу (по умолчанию 100)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Смещение (по умолчанию 0)',
  })
  @ApiQuery({
    name: 'email',
    required: false,
    type: String,
    description: 'Фильтр по email (частичное совпадение)',
  })
  @ApiQuery({
    name: 'firstName',
    required: false,
    type: String,
    description: 'Фильтр по имени (частичное совпадение)',
  })
  @ApiQuery({
    name: 'lastName',
    required: false,
    type: String,
    description: 'Фильтр по фамилии (частичное совпадение)',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['created_at', 'first_name', 'last_name', 'email'],
    description: 'Поле сортировки',
  })
  @ApiQuery({
    name: 'orderDir',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Направление сортировки',
  })
  @ApiResponse({
    status: 200,
    description: 'Список пользователей',
    schema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          items: { $ref: '#/components/schemas/UserWithoutExcludedDto' },
        },
        total: { type: 'number' },
      },
    },
  })
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('email') email?: string,
    @Query('firstName') firstName?: string,
    @Query('lastName') lastName?: string,
    @Query('orderBy')
    orderBy?: 'created_at' | 'first_name' | 'last_name' | 'email',
    @Query('orderDir') orderDir?: 'ASC' | 'DESC',
  ): Promise<{ rows: UserWithoutExcludedDto[]; total: number }> {
    const result = await this.userService.findAll({
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      filter: { email, firstName, lastName },
      orderBy,
      orderDir,
    });

    return {
      rows: result.rows.map((user) => UserMapper.toDto(user)),
      total: result.total,
    };
  }

  // ============================================================
  //  ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ ПО ID
  // ============================================================
  @Get(':id')
  @ApiOperation({ summary: 'Получить пользователя по ID' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID пользователя',
  })
  @ApiResponse({
    status: 200,
    description: 'Найденный пользователь',
    type: UserWithoutExcludedDto,
  })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserWithoutExcludedDto> {
    const user = await this.userService.findUserById(id);
    if (!user) {
      throw new NotFoundException('Пользователь не найден');
    }
    return UserMapper.toDto(user);
  }

  // ============================================================
  //  ОБНОВЛЕНИЕ ПОЛЬЗОВАТЕЛЯ (частичное)
  // ============================================================
  @Put(':id')
  @ApiOperation({
    summary: 'Обновить данные пользователя (частичное обновление)',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID пользователя',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'Обновлённый пользователь',
    type: UserWithoutExcludedDto,
  })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
  @ApiBadRequestResponse({ description: 'Неверные данные' })
  @ApiConflictResponse({
    description: 'Email уже используется другим пользователем',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateUserDto,
  ): Promise<UserWithoutExcludedDto> {
    const updateData = UserMapper.toUpdateUserData(id, updateDto);
    const updated = await this.userService.updateUser(updateData);
    if (!updated) {
      throw new NotFoundException('Пользователь не найден');
    }
    return UserMapper.toDto(updated);
  }

  // ============================================================
  //  УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ
  // ============================================================
  @Delete(':id')
  @ApiOperation({ summary: 'Удалить пользователя' })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'UUID пользователя',
  })
  @ApiResponse({ status: 204, description: 'Пользователь удалён' })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.userService.deleteUser(id);
  }
}
