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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateCityDto } from './dto/createCity.dto.js';
import { CityResponseDto } from './dto/cityResponse.dto.js';
import { UpdateCityDto } from './dto/updateCity.dto.js';
import type { CityService } from './interfaces/cityService.interface.js';
import { CITY_SERVICE } from './tokens.js';
import { JwtAuthGuard } from '../auth/guards/auth.guard.js';

@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@ApiTags('Города')
@Controller('cities')
export class CityController {
  constructor(
    @Inject(CITY_SERVICE)
    private readonly cityService: CityService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Создать новый город' })
  @ApiBody({ type: CreateCityDto })
  @ApiCreatedResponse({
    description: 'Город успешно создан',
    type: CityResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  async create(@Body() createCityDto: CreateCityDto): Promise<CityResponseDto> {
    return this.cityService.create(createCityDto);
  }

  @Get()
  @ApiOperation({ summary: 'Получить все города' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Поиск по названию города',
    example: 'мос',
  })
  @ApiOkResponse({
    description: 'Список городов получен успешно',
    type: [CityResponseDto],
  })
  async findAll(@Query('search') search?: string): Promise<CityResponseDto[]> {
    if (search) {
      return this.cityService.searchByName(search);
    }
    return this.cityService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить город по ID' })
  @ApiParam({
    name: 'id',
    description: 'ID города',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Информация о городе получена успешно',
    type: CityResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Город не найден' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CityResponseDto> {
    return this.cityService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить информацию о городе' })
  @ApiParam({
    name: 'id',
    description: 'ID города',
    type: Number,
    example: 1,
  })
  @ApiBody({ type: UpdateCityDto })
  @ApiOkResponse({
    description: 'Город успешно обновлен',
    type: CityResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Город не найден' })
  @ApiBadRequestResponse({ description: 'Неверные входные данные' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCityDto: UpdateCityDto,
  ): Promise<CityResponseDto> {
    return this.cityService.update(id, updateCityDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удалить город' })
  @ApiParam({
    name: 'id',
    description: 'ID города',
    type: Number,
    example: 1,
  })
  @ApiOkResponse({
    description: 'Город успешно удален',
  })
  @ApiNotFoundResponse({ description: 'Город не найден' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.cityService.remove(id);
  }
}
