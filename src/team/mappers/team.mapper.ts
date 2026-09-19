import type { Team } from '../entities/types/team.types.js';
import type { TeamResponseDto } from '../dto/teamResponse.dto.js';
import { ReferenceValidation } from '../../common/references/reference-validation.js';
export class TeamMapper {
  static async toDto(entity: Team): Promise<TeamResponseDto> {
    return {
      ...entity,
      id: await ReferenceValidation.id(entity.id),
      cityId: await ReferenceValidation.id(entity.cityId),
    };
  }
}
