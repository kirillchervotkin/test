// src/result-test-types/dto/result-id-param.dto.ts

import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class ResultIdParamDto {
  @IsUUID()
  @Constraint({
    dbField: 'result_id',
  })
  resultId: string;
}
