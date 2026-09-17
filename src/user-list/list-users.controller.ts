// user-list/list-users.controller.ts
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { UserListService } from './user-list.service.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { UserListMapper } from './user-list.mapper.js';

@ApiTags('Пользователи списков')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('lists') // базовый путь
export class ListUsersController {
  constructor(private readonly userListService: UserListService) {}

  @Get(':listId/users')
  @ApiOperation({
    summary: 'Получить всех пользователей, привязанных к списку',
  })
  @ApiParam({ name: 'listId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  async getUsersByList(
    @Param('listId') listId: string,
  ): Promise<UserResponseDto[]> {
    const users = await this.userListService.findUsersByList(listId);
    return UserListMapper.toUserDtoArray(users);
  }
}
