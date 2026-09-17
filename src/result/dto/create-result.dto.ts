import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { RESULT_STATUSES } from '../entities/types/result.types.js';
import type { ResultStatus } from '../entities/types/result.types.js';
import { IsResultStatusConsistent } from './validators/is-result-status-consistent.validator.js';

export class CreateResultItemDto {
  @ApiProperty({
    example: false,
    description: 'true – забег на 10 м, false – основной',
  })
  @IsBoolean()
  isTen: boolean;

  @ApiProperty({
    example: 1,
    description: 'Номер забега (1, 2 или 3)',
    minimum: 1,
    maximum: 3,
  })
  @IsInt()
  @Min(1)
  @Max(3)
  legNumber: number;

  @ApiProperty({
    description:
      'Статус результата. По умолчанию "completed" — обычный зачтённый ' +
      'зачёт. Значение "not_credited" — техническая ошибка / помешал ' +
      'соперник. Значение "not_admitted" — спортсмен не допущен к тесту.',
    enum: RESULT_STATUSES,
    example: 'completed',
    required: false,
  })
  @IsOptional()
  @IsIn(RESULT_STATUSES)
  @IsResultStatusConsistent()
  status?: ResultStatus;

  @ApiProperty({
    example: 12.34,
    description: 'Время в секундах (для обычных тестов). Опционально.',
    minimum: 0,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  time?: number | null;

  @ApiProperty({
    example: 16,
    description: 'Уровень (для теста «уровень + отрезки»). Опционально.',
    minimum: 0,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  level?: number | null;

  @ApiProperty({
    example: 3,
    description: 'Количество отрезков (для тестов с отрезками). Опционально.',
    minimum: 0,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  segments?: number | null;
}
