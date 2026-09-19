// src/training/dto/list-training-sessions-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { TrainingSessionListItemDto } from './training-session-response.dto.js';

/**
 * Ответ GET /training-sessions.
 *
 * `sessions` — список тренировок за запрошенный период, без сэмплов.
 * Сэмплы тянутся отдельно при открытии конкретной тренировки
 * (GET /training-sessions/:provider/:externalId).
 *
 * `sportTypes` — словарь только для тех кодов, которые реально
 * встречаются в `sessions`. Фронт использует его для рендеринга
 * display-имён без отдельного запроса справочника.
 *
 * `total` (общее количество за период) не возвращаем: без
 * offset-пагинации он не несёт смысла, а показать в UI «всего 247
 * тренировок» можно по длине массива, если запросили всё за период.
 * Если понадобится для счётчика при обрезанном по `limit` ответе —
 * добавим отдельно.
 */
export class ListTrainingSessionsResponseDto {
  @ApiProperty({
    type: [TrainingSessionListItemDto],
    description: 'Список тренировок за период',
  })
  sessions: TrainingSessionListItemDto[];

  @ApiProperty({
    description:
      'Словарь видов спорта, встречающихся в выборке. ' +
      'Ключи — коды видов спорта; значения — display-имена ru/en.',
    example: {
      running: { ru: 'Бег', en: 'Running' },
      cycling: { ru: 'Велосипед', en: 'Cycling' },
    },
  })
  sportTypes: Record<string, { ru: string; en: string }>;
}
