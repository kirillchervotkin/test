// src/training/dto/samples-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import type { SampleType } from '../entities/types/training-samples.types.js';

/**
 * Распакованные сэмплы одного типа: интервал и массив значений.
 * Используется в ответе getSessionWithSamples.
 */
export class ParsedSampleDto {
  @ApiProperty({
    description: 'Интервал между точками в секундах',
    example: 5,
  })
  intervalSec: number;

  @ApiProperty({
    description: 'Значения в порядке возрастания времени',
    type: [Number],
    example: [88, 90, 92, 95, 98],
  })
  values: number[];
}

/**
 * Сырой блоб сэмплов одного типа в base64.
 *
 * Используется в ответе getRawSamples: фронт сам декодирует
 * base64 в DataView и строит график без промежуточного шага
 * «распаковать на бэке → сериализовать в JSON».
 */
export class RawSampleDto {
  @ApiProperty({
    description: 'Интервал между точками в секундах',
    example: 5,
  })
  intervalSec: number;

  @ApiProperty({
    description:
      'Base64-encoded бинарный блоб (little-endian). ' +
      '1 байт на точку для hr/cadence/temperature, ' +
      '2 байта для power/distance, 4 байта для speed/altitude.',
    example: 'WFpcWVlZ',
  })
  samplesBase64: string;
}

/**
 * Ответ GET /training-sessions/:provider/:externalId/raw-samples.
 *
 * `samples` — Partial<Record<...>>: отсутствующие типы (провайдер
 * их не прислал) в объекте отсутствуют, а не равны null. Это
 * позволяет фронту отличить «нет данных» от «пустые данные».
 */
export class RawSamplesResponseDto {
  @ApiProperty({
    description: 'ID тренировки (детерминированный хеш)',
    example: 'a1b2c3d4e5f6...',
  })
  sessionId: string;

  @ApiProperty({
    description:
      'Сырые блобы по типам. Ключи — SampleType ' +
      '("hr", "speed", "power", "cadence", "altitude", "distance", "temperature").',
    example: {
      hr: { intervalSec: 5, samplesBase64: 'WFpcWVlZ' },
      speed: { intervalSec: 5, samplesBase64: 'AAAAQA==' },
    },
  })
  samples: Partial<Record<SampleType, RawSampleDto>>;
}
