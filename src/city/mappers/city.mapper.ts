import type { City } from '../entities/types/city.types.js';
import type { CityResponseDto } from '../dto/cityResponse.dto.js';
import { ReferenceValidation } from '../../common/references/reference-validation.js';
export class CityMapper {
  static async toDto(entity: City): Promise<CityResponseDto> {
    return { ...entity, id: await ReferenceValidation.id(entity.id) };
  }
}
