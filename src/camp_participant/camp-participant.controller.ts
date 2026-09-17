// src/camp-participant/camp-participant.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { CampParticipantService } from './camp-participant.service.js';
import { CampParticipantMapper } from './mappers/camp-participant.mapper.js';
import { CreateCampParticipantDto } from './dto/create-camp-participant.dto.js';
import { BulkAddParticipantsDto } from './dto/bulk-add-participants.dto.js';
import { BulkRemoveParticipantsDto } from './dto/bulk-remove-participants.dto.js';
import { UpdateBibDto } from './dto/update-bib.dto.js';
import {
  CampUserDto,
  CampParticipationDto,
} from './dto/camp-participant-response.dto.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

@ApiTags('Участники тренировочных лагерей')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('camps')
export class CampParticipantController {
  constructor(private readonly service: CampParticipantService) {}

  // ============================================================
  // 1. ПОЛУЧИТЬ ВСЕХ УЧАСТНИКОВ (ПОЛЬЗОВАТЕЛЕЙ) ЛАГЕРЯ
  // ============================================================
  @Get(':campId/users')
  @ApiOperation({
    summary: 'Получить всех пользователей, участвующих в тренировочном лагере',
    description: 'Возвращает массив пользователей с их номерами bib.',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiResponse({
    status: 200,
    description: 'Список пользователей лагеря с номерами bib',
    type: [CampUserDto],
  })
  async getUsers(
    @Param('campId', ParseUUIDPipe) campId: string,
  ): Promise<CampUserDto[]> {
    const entities = await this.service.findAllByCamp(campId);
    return CampParticipantMapper.toUserDtoList(entities);
  }

  // ============================================================
  // 2. ДОБАВИТЬ ОДНОГО ПОЛЬЗОВАТЕЛЯ В ЛАГЕРЬ
  // ============================================================
  @Post(':campId/users')
  @ApiOperation({
    summary: 'Добавить одного пользователя в тренировочный лагерь',
    description: 'Номер bib назначается автоматически (max(bib) + 1).',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiBody({ type: CreateCampParticipantDto })
  @ApiCreatedResponse({
    description: 'Пользователь успешно добавлен в лагерь',
    type: CampUserDto,
  })
  @ApiBadRequestResponse({ description: 'Некорректные входные данные' })
  @ApiConflictResponse({
    description: 'Пользователь уже является участником лагеря или конфликт bib',
  })
  @ApiNotFoundResponse({ description: 'Лагерь или пользователь не найдены' })
  async addUser(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Body() dto: CreateCampParticipantDto,
  ): Promise<CampUserDto> {
    const entity = await this.service.create(campId, dto);
    // Временно получаем обновлённый список и ищем созданного участника
    const all = await this.service.findAllByCamp(campId);
    const found = all.find((p) => p.userId === entity.userId);
    if (!found) {
      throw new NotFoundException('Не удалось найти созданного участника');
    }
    return CampParticipantMapper.toUserDto(found);
  }

  // ============================================================
  // 3. МАССОВОЕ ДОБАВЛЕНИЕ ПОЛЬЗОВАТЕЛЕЙ В ЛАГЕРЬ
  // ============================================================
  @Post(':campId/users/bulk')
  @ApiOperation({
    summary: 'Массовое добавление пользователей в тренировочный лагерь',
    description:
      'Пропускает пользователей, которые уже являются участниками. Номера bib назначаются последовательно.',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiBody({ type: BulkAddParticipantsDto })
  @ApiCreatedResponse({
    description: 'Пользователи успешно добавлены',
    type: [CampUserDto],
  })
  @ApiBadRequestResponse({ description: 'Некорректные входные данные' })
  @ApiNotFoundResponse({
    description: 'Лагерь или некоторые пользователи не найдены',
  })
  async addUsersBulk(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Body() dto: BulkAddParticipantsDto,
  ): Promise<CampUserDto[]> {
    await this.service.bulkAdd(campId, dto);
    const entities = await this.service.findAllByCamp(campId);
    return CampParticipantMapper.toUserDtoList(entities);
  }

  // ============================================================
  // 4. ПОЛУЧИТЬ ОДНОГО ПОЛЬЗОВАТЕЛЯ ЛАГЕРЯ С ЕГО BIB
  // ============================================================
  @Get(':campId/users/:userId')
  @ApiOperation({
    summary: 'Получить данные пользователя с его номером bib в лагере',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'UUID пользователя',
  })
  @ApiResponse({
    status: 200,
    description: 'Пользователь найден',
    type: CampUserDto,
  })
  @ApiNotFoundResponse({
    description: 'Пользователь не найден в данном лагере',
  })
  async getUser(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<CampUserDto> {
    const entity = await this.service.findOne(campId, userId);
    if (!entity) {
      throw new NotFoundException(
        `Пользователь с id ${userId} не найден в лагере ${campId}`,
      );
    }
    const all = await this.service.findAllByCamp(campId);
    const found = all.find((p) => p.userId === userId);
    if (!found) {
      throw new NotFoundException('Не удалось загрузить данные пользователя');
    }
    return CampParticipantMapper.toUserDto(found);
  }

  // ============================================================
  // 5. ОБНОВЛЕНИЕ НОМЕРА (BIB) ПОЛЬЗОВАТЕЛЯ В ЛАГЕРЕ
  // ============================================================
  @Patch(':campId/users/:userId/bib')
  @ApiOperation({
    summary: 'Ручное обновление номера (bib) участника',
    description: 'Проверяет, что новый номер уникален в рамках лагеря.',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'UUID пользователя',
  })
  @ApiBody({ type: UpdateBibDto })
  @ApiResponse({
    status: 200,
    description: 'Номер bib успешно обновлён',
    type: CampUserDto,
  })
  @ApiNotFoundResponse({
    description: 'Участник с такими campId и userId не найден',
  })
  @ApiConflictResponse({ description: 'Новый номер bib уже занят' })
  async updateBib(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateBibDto,
  ): Promise<CampUserDto> {
    await this.service.updateBib(campId, userId, dto);
    const all = await this.service.findAllByCamp(campId);
    const found = all.find((p) => p.userId === userId);
    if (!found) {
      throw new NotFoundException(
        `Пользователь с id ${userId} не найден в лагере ${campId}`,
      );
    }
    return CampParticipantMapper.toUserDto(found);
  }

  // ============================================================
  // 6. УДАЛИТЬ ОДНОГО ПОЛЬЗОВАТЕЛЯ ИЗ ЛАГЕРЯ
  // ============================================================
  @Delete(':campId/users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить пользователя из тренировочного лагеря',
    description:
      'Удаляет пользователя и пересчитывает номера bib для оставшихся.',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'UUID пользователя',
  })
  @ApiNoContentResponse({ description: 'Пользователь успешно удалён' })
  @ApiNotFoundResponse({ description: 'Пользователь не найден' })
  async removeUser(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.service.deleteOne(campId, userId);
  }

  // ============================================================
  // 7. МАССОВОЕ УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЕЙ ИЗ ЛАГЕРЯ
  // ============================================================
  @Delete(':campId/users')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Массовое удаление пользователей из тренировочного лагеря',
    description: 'Удаляет указанных пользователей и пересчитывает номера bib.',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiBody({ type: BulkRemoveParticipantsDto })
  @ApiNoContentResponse({ description: 'Пользователи успешно удалены' })
  @ApiBadRequestResponse({ description: 'Некорректные входные данные' })
  @ApiNotFoundResponse({ description: 'Лагерь не найден' })
  async removeUsersBulk(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Body() dto: BulkRemoveParticipantsDto,
  ): Promise<void> {
    await this.service.bulkRemove(campId, dto);
  }

  // ============================================================
  // 8. ОЧИСТИТЬ ЛАГЕРЬ (УДАЛИТЬ ВСЕХ УЧАСТНИКОВ)
  // ============================================================
  @Delete(':campId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить всех участников из тренировочного лагеря',
    description: 'Полностью очищает лагерь от участников.',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiNoContentResponse({ description: 'Все участники удалены' })
  async clearCamp(
    @Param('campId', ParseUUIDPipe) campId: string,
  ): Promise<void> {
    await this.service.deleteAllByCamp(campId);
  }

  // ============================================================
  // 9. ПОЛУЧИТЬ ВСЕ УЧАСТИЯ ПОЛЬЗОВАТЕЛЯ (ВО ВСЕХ ЛАГЕРЯХ)
  // ============================================================
  @Get('users/:userId/participations')
  @ApiOperation({
    summary: 'Получить все участия пользователя в лагерях',
    description:
      'Возвращает список лагерей, где пользователь участвует, с номерами bib.',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'UUID пользователя',
  })
  @ApiResponse({
    status: 200,
    description: 'Список участий',
    type: [CampParticipationDto],
  })
  async getUserParticipations(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<CampParticipationDto[]> {
    const entities = await this.service.findAllByUser(userId);
    return CampParticipantMapper.toCampParticipationDtoList(entities);
  }

  // ============================================================
  // 10. ПРОВЕРКА СУЩЕСТВОВАНИЯ ПОЛЬЗОВАТЕЛЯ В ЛАГЕРЕ
  // ============================================================
  @Get('exists/:campId/:userId')
  @ApiOperation({
    summary: 'Проверить, существует ли пользователь в тренировочном лагере',
  })
  @ApiParam({
    name: 'campId',
    type: 'string',
    format: 'uuid',
    description: 'UUID тренировочного лагеря',
  })
  @ApiParam({
    name: 'userId',
    type: 'string',
    format: 'uuid',
    description: 'UUID пользователя',
  })
  @ApiResponse({
    status: 200,
    description: 'Булево значение, указывающее на существование',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
      },
    },
  })
  async exists(
    @Param('campId', ParseUUIDPipe) campId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ exists: boolean }> {
    const exists = await this.service.exists(campId, userId);
    return { exists };
  }
}
