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
import type { TeamService } from './interfaces/teamService.interface.js';
import { CreateTeamDto } from './dto/createTeam.dto.js';
import { TEAM_SERVICE } from './tokens.js';
import { TeamResponseDto } from './dto/teamResponse.dto.js';
import { UpdateTeamDto } from './dto/updateTeam.dto.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

@ApiTags('Команды')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamController {
  constructor(
    @Inject(TEAM_SERVICE)
    private readonly teamService: TeamService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создать новую команду' })
  @ApiBody({ type: CreateTeamDto })
  @ApiCreatedResponse({
    description: 'Команда успешно создана',
    type: TeamResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  async create(@Body() createTeamDto: CreateTeamDto): Promise<TeamResponseDto> {
    return await this.teamService.create(createTeamDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить все команды' })
  @ApiOkResponse({
    description: 'Список команд получен успешно',
    type: [TeamResponseDto],
  })
  async findAll(): Promise<TeamResponseDto[]> {
    return await this.teamService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить команду по ID' })
  @ApiParam({
    name: 'id',
    description: 'ID команды',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Информация о команде получена успешно',
    type: TeamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Команда не найдена' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TeamResponseDto> {
    return await this.teamService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить информацию о команде' })
  @ApiParam({
    name: 'id',
    description: 'ID команды',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateTeamDto })
  @ApiOkResponse({
    description: 'Команда успешно обновлена',
    type: TeamResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Команда не найдена' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTeamDto: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    return await this.teamService.update(id, updateTeamDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить команду' })
  @ApiParam({
    name: 'id',
    description: 'ID команды',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Команда успешно удалена',
    schema: {
      example: { message: 'Команда с ID 1 успешно удалена' },
    },
  })
  @ApiNotFoundResponse({ description: 'Команда не найдена' })
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.teamService.remove(id);
    return { message: `Команда с ID ${id} успешно удалена` };
  }
}
