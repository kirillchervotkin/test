// src/matches/dto/paginated-match-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { MatchResponseDto } from './matchResponse.dto.js';

export class PaginatedMatchResponseDto {
  @ApiProperty({
    description: 'Список матчей на текущей странице',
    type: [MatchResponseDto],
  })
  rows: MatchResponseDto[];

  @ApiProperty({
    description: 'Общее количество матчей, удовлетворяющих фильтру',
    example: 306,
  })
  total: number;
}
