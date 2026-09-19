// src/training/dto/list-training-sessions-query.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query-параметры для GET /training-sessions.
 *
 * `from` и `to` обязательны: список тренировок всегда запрашивается
 * за конкретный период. Диапазон — [from, to), как и в репозитории
 * (from inclusive, to exclusive).
 *
 * Максимальный период (366 дней) проверяется в сервисе, а не здесь:
 * class-validator не умеет делать кросс-полевую валидацию query
 * без костылей, а сервис всё равно парсит даты в `Date`. Если
 * период превышает год — сервис бросит BadRequestException.
 *
 * `limit` — опциональный. Дефолт (500) выставляется в сервисе.
 * Верхняя граница (1000) защищает от «дай мне всё за 10 лет».
 * Фронт обычно не передаёт `limit` — за год у активного
 * пользователя 250–350 тренировок, они влезают в дефолт целиком.
 * `offset` в контракте нет: сценарий «показать ещё» пока не
 * актуален, а репозиторий уже поддерживает пагинацию, если
 * понадобится.
 *
 * Формат дат — ISO 8601 (например, `2026-09-01` или
 * `2026-09-01T00:00:00Z`). Приведение к `Date` делает сервис.
 *
 * `@Type(() => Number)` нужен, потому что query-параметры приходят
 * строками («500»), и без трансформации `@IsInt()` отклонил бы их.
 */
export class ListTrainingSessionsQueryDto {
  @ApiProperty({
    description: 'Начало периода (включительно), ISO 8601',
    example: '2026-01-01T00:00:00Z',
  })
  @IsISO8601()
  from: string;

  @ApiProperty({
    description: 'Конец периода (не включается), ISO 8601',
    example: '2026-12-31T23:59:59Z',
  })
  @IsISO8601()
  to: string;

  @ApiProperty({
    description:
      'Максимум записей в ответе. По умолчанию 500. ' +
      'Используется как страховка от гигантских ответов; ' +
      'в обычном сценарии фронт не передаёт этот параметр.',
    example: 500,
    required: false,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
