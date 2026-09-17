import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { UserListService } from './user-list.service.js';
import { AssignListDto } from './dto/assign-list.dto.js';
import { UserListResponseDto } from './dto/user-list-response.dto.js';
import { UserListMapper } from './user-list.mapper.js';
import { UserIdParamDto } from './dto/user-id-param.dto.js';
import { UnassignListParamsDto } from './dto/unassign-list-params.dto.js';

@ApiTags('Привязка списков (подресурс)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users/:userId/lists')
export class UserListController {
  constructor(private readonly userListService: UserListService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Привязать список к пользователю' })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID пользователя',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiBody({ type: AssignListDto })
  @ApiResponse({
    status: 201,
    description: 'Список успешно привязан',
    type: UserListResponseDto,
  })
  @ApiConflictResponse({
    description: 'Список уже привязан к этому пользователю',
  })
  @ApiNotFoundResponse({ description: 'Пользователь или список не найдены' })
  @ApiBadRequestResponse({ description: 'Невалидные данные' })
  async assignList(
    @Param() params: UserIdParamDto,
    @Body() dto: AssignListDto,
  ): Promise<UserListResponseDto> {
    const relation = await this.userListService.assignListToUser({
      userId: params.userId,
      listId: dto.listId,
    });
    return UserListMapper.toDto(relation);
  }

  @Delete(':listId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Отвязать список от пользователя' })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID пользователя',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'listId',
    type: 'string',
    format: 'uuid',
    description: 'ID списка',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 204,
    description: 'Список успешно отвязан',
  })
  @ApiNotFoundResponse({ description: 'Связь не найдена' })
  @ApiBadRequestResponse({ description: 'Невалидные данные' })
  async unassignList(@Param() params: UnassignListParamsDto): Promise<void> {
    await this.userListService.unassignListFromUser({
      userId: params.userId,
      listId: params.listId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Получить все списки пользователя' })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'ID пользователя',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Список связей пользователя',
    type: [UserListResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
  async getUserLists(
    @Param() params: UserIdParamDto,
  ): Promise<UserListResponseDto[]> {
    const relations = await this.userListService.getUserLists(params.userId);
    return UserListMapper.toDtoArray(relations);
  }
}
