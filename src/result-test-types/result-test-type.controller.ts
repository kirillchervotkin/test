// src/result-test-types/result-test-type.controller.ts

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';
import { ResultTestTypeService } from './result-test-type.service.js';
import { AttachTestTypesDto } from './dto/attach-test-types.dto.js';
import { ResultTestTypeResponseDto } from './dto/result-test-type-response.dto.js';
import { ResultTestTypeMapper } from './mappers/result-test-type.mapper.js';

@ApiTags('Result Test Types')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultTestTypeController {
  constructor(private readonly resultTestTypeService: ResultTestTypeService) {}

  // ============================================================
  // 1. ПОЛУЧИТЬ ВСЕ ТИПЫ ТЕСТОВ, ПРИВЯЗАННЫЕ К РЕЗУЛЬТАТУ
  // ============================================================
  @Get(':resultId/test-types')
  @ApiOperation({
    summary: 'Get all test types attached to a result',
    description:
      'Returns all links between the result and its test types. ' +
      'A result may have one or several test types (e.g. female and male for comparison).',
  })
  @ApiParam({
    name: 'resultId',
    type: 'string',
    format: 'uuid',
    description: 'Surrogate UUID of the result',
  })
  @ApiResponse({
    status: 200,
    description: 'List of test type links for the result',
    type: [ResultTestTypeResponseDto],
  })
  async findByResultId(
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ): Promise<ResultTestTypeResponseDto[]> {
    const links = await this.resultTestTypeService.findByResultId(resultId);
    return ResultTestTypeMapper.toDtoList(links);
  }

  // ============================================================
  // 2. ПРИВЯЗАТЬ ОДИН ИЛИ НЕСКОЛЬКО ТИПОВ ТЕСТОВ К РЕЗУЛЬТАТУ
  // ============================================================
  @Post(':resultId/test-types')
  @ApiOperation({
    summary: 'Attach one or more test types to a result',
    description:
      'Creates links between an existing result and one or more test types. ' +
      'For female results usually two types are attached: female (native) and male (for comparison). ' +
      'Attaching a test type that is already linked will result in 409 Conflict.',
  })
  @ApiParam({
    name: 'resultId',
    type: 'string',
    format: 'uuid',
    description: 'Surrogate UUID of the result',
  })
  @ApiBody({ type: AttachTestTypesDto })
  @ApiCreatedResponse({
    description: 'Test types attached successfully',
    type: [ResultTestTypeResponseDto],
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiNotFoundResponse({ description: 'One or more test types not found' })
  @ApiConflictResponse({
    description: 'One or more of the test type links already exist',
  })
  async attachTestTypes(
    @Param('resultId', ParseUUIDPipe) resultId: string,
    @Body() dto: AttachTestTypesDto,
  ): Promise<ResultTestTypeResponseDto[]> {
    const links = await this.resultTestTypeService.attachTestTypes(
      resultId,
      dto.testTypeIds,
    );
    return ResultTestTypeMapper.toDtoList(links);
  }
}
