// src/results/dto/update-result.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsInt, IsOptional, IsIn, Min } from 'class-validator';
import { RESULT_STATUSES } from '../entities/types/result.types.js';
import type { ResultStatus } from '../entities/types/result.types.js';

export class UpdateResultDto {
  @ApiProperty({
    required: false,
    description:
      'Новый статус результата: ' +
      '"completed" — зачтён, ' +
      '"not_credited" — выполнен, но не зачтён (техническая ошибка), ' +
      '"not_admitted" — спортсмен не допущен к тесту. ' +
      'Поле не может быть сброшено в null — статус обязателен в БД.',
    enum: RESULT_STATUSES,
    example: 'not_credited',
  })
  @IsOptional()
  @IsIn(RESULT_STATUSES)
  status?: ResultStatus;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 12.34,
    description: 'Новое время в секундах (для обычных тестов)',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  time?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 16,
    description: 'Новый уровень (для теста «уровень + отрезки»)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 3,
    description: 'Новое количество отрезков (для тестов с отрезками)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  segments?: number | null;
}
