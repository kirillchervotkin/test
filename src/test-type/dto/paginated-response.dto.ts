// src/modules/test-types/dto/paginated-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { TestTypeResponseDto } from './response.dto.js';

export class PaginatedTestTypeResponseDto {
  @ApiProperty({
    type: [TestTypeResponseDto],
    description: 'Список типов тестов на текущей странице',
  })
  rows: TestTypeResponseDto[];

  @ApiProperty({
    example: 42,
    description: 'Общее количество типов тестов',
  })
  total: number;
}
