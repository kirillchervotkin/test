import { CreateCityDto } from '../dto/createCity.dto.js';
import { UpdateCityDto } from '../dto/updateCity.dto.js';
import { CityResponseDto } from '../dto/cityResponse.dto.js';

export interface CityService {
  create(createCityDto: CreateCityDto): Promise<CityResponseDto>;
  findAll(): Promise<CityResponseDto[]>;
  findOne(id: string): Promise<CityResponseDto>;
  update(id: string, updateCityDto: UpdateCityDto): Promise<CityResponseDto>;
  remove(id: string): Promise<void>;
  searchByName(name: string): Promise<CityResponseDto[]>;
}
