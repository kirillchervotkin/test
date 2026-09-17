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
  UseGuards,
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
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateGroupDto } from './dto/createGroup.dto.js';
import { GroupResponseDto } from './dto/groupResponse.dto.js';
import { UpdateGroupDto } from './dto/updateGroup.dto.js';
import type { GroupsService } from './interfaces/groupService.interface.js';
import { GROUP_SERVICE } from './tokens.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

@ApiTags('Группы турнира')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tournaments/:tournamentId/groups')
export class GroupController {
  constructor(
    @Inject(GROUP_SERVICE)
    private readonly groupsService: GroupsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создать новую группу в турнире' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: CreateGroupDto })
  @ApiCreatedResponse({
    description: 'Группа успешно создана',
    type: GroupResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  async create(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Body() createGroupDto: CreateGroupDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.create(tournamentId, createGroupDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить список всех групп турнира' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Список групп турнира получен успешно',
    type: [GroupResponseDto],
  })
  @ApiNotFoundResponse({ description: 'Турнир не найден' })
  async findAllByTournamentId(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
  ): Promise<GroupResponseDto[]> {
    return this.groupsService.findAllByTournamentId(tournamentId);
  }

  @Get(':groupId')
  @ApiOperation({
    summary: 'Получить информацию о конкретной группе в турнире',
  })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID группы',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Информация о группе получена успешно',
    type: GroupResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Группа или турнир не найден' })
  findOneByTournamentId(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<GroupResponseDto> {
    return this.groupsService.findOneByTournamentId(groupId, tournamentId);
  }

  @Put(':groupId')
  @ApiOperation({ summary: 'Обновить информацию о группе в турнире' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID группы',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateGroupDto })
  @ApiOkResponse({
    description: 'Группа успешно обновлена',
    type: GroupResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Группа или турнир не найден' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  update(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() updateGroupDto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    return this.groupsService.update(groupId, tournamentId, updateGroupDto);
  }

  @Delete(':groupId')
  @ApiOperation({ summary: 'Удалить группу из турнира' })
  @ApiParam({
    name: 'tournamentId',
    description: 'ID турнира',
    type: Number,
    example: 1,
  })
  @ApiParam({
    name: 'groupId',
    description: 'ID группы',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Группа успешно удалена',
  })
  @ApiNotFoundResponse({ description: 'Группа или турнир не найден' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('tournamentId', ParseIntPipe) tournamentId: number,
    @Param('groupId', ParseIntPipe) groupId: number,
  ): Promise<void> {
    await this.groupsService.remove(groupId, tournamentId);
  }
}
