// src/result-test-types/dto/result-test-type-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class ResultTestTypeResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  resultId: string;

  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440001' })
  testTypeId: string;
}
