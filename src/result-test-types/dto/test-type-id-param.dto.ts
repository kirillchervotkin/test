// src/result-test-types/dto/test-type-id-param.dto.ts

import { IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class TestTypeIdParamDto {
  @IsUUID()
  @Constraint({
    dbField: 'test_type_id',
  })
  testTypeId: string;
}
