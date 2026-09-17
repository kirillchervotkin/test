import { PartialType } from '@nestjs/swagger';
import { CreateCityDto } from './createCity.dto.js';

export class UpdateCityDto extends PartialType(CreateCityDto) {}
