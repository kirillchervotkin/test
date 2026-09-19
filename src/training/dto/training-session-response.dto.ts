// src/training/dto/training-session-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import type { SampleType } from '../entities/types/training-samples.types.js';
import { ParsedSampleDto } from './samples-response.dto.js';

/**
 * Элемент списка тренировок и базовая форма ответа одной тренировки.
 *
 * Не содержит samples: список лёгкий, детали тянутся отдельно
 * (getSessionWithSamples). Все поля — из канонической модели,
 * без провайдер-специфичных деталей.
 */
export class TrainingSessionListItemDto {
  @ApiProperty({
    description: 'ID тренировки (детерминированный хеш)',
    example: 'a1b2c3d4e5f6...',
  })
  id: string;

  @ApiProperty({
    description: 'Провайдер, от которого пришла тренировка',
    example: 'polar',
    enum: ['polar', 'suunto', 'garmin'],
  })
  provider: string;

  @ApiProperty({
    description: 'ID тренировки у провайдера',
    example: 'y6NNvlRM',
  })
  externalId: string;

  @ApiProperty({
    description: 'UTC-время старта тренировки',
    example: '2026-09-18T05:30:00.000Z',
  })
  startTime: Date;

  @ApiProperty({
    description: 'Длительность в секундах',
    example: 3600,
  })
  durationSec: number;

  @ApiProperty({
    description: 'Нормализованный код вида спорта',
    nullable: true,
    example: 'running',
  })
  sport: string | null;

  @ApiProperty({
    description: 'Дистанция в метрах',
    nullable: true,
    example: 9840,
  })
  distanceM: number | null;

  @ApiProperty({
    description: 'Калории',
    nullable: true,
    example: 500,
  })
  calories: number | null;

  @ApiProperty({
    description: 'Средний пульс',
    nullable: true,
    example: 145,
  })
  hrAvg: number | null;

  @ApiProperty({
    description: 'Максимальный пульс',
    nullable: true,
    example: 178,
  })
  hrMax: number | null;

  @ApiProperty({
    description: 'Минимальный пульс',
    nullable: true,
    example: 88,
  })
  hrMin: number | null;

  @ApiProperty({
    description: 'Набор высоты в метрах',
    nullable: true,
    example: 120,
  })
  ascentM: number | null;

  @ApiProperty({
    description: 'Сброс высоты в метрах',
    nullable: true,
    example: 115,
  })
  descentM: number | null;

  @ApiProperty({
    description: 'Отображаемое имя (пользовательское поле Arbitrator)',
    nullable: true,
    example: 'Утренняя пробежка',
  })
  name: string | null;

  @ApiProperty({
    description: 'Заметки пользователя Arbitrator',
    nullable: true,
    example: 'Чувствовал себя хорошо',
  })
  notes: string | null;
}

/**
 * Ответ одной тренировки с распакованными сэмплами.
 * Расширяет элемент списка полем samples.
 */
export class TrainingSessionWithSamplesDto extends TrainingSessionListItemDto {
  @ApiProperty({
    description:
      'Распакованные сэмплы по типам. Ключи — SampleType; ' +
      'отсутствующие типы в объекте не появляются.',
    example: {
      hr: { intervalSec: 5, values: [88, 90, 92] },
      speed: { intervalSec: 5, values: [10.5, 10.8, 11.2] },
    },
  })
  samples: Partial<Record<SampleType, ParsedSampleDto>>;
}
