// webhook/dto/webhookEvent.dto.ts
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUrl } from 'class-validator';

/**
 * События, которые может прислать Polar AccessLink через вебхук.
 * Даже если мы пока обрабатываем только EXERCISE, остальные нужно
 * пропускать через валидацию — иначе ValidationPipe отклонит сообщение
 * с 422 и оно зациклится в очереди.
 */
export type PolarEventType =
  | 'PING'
  | 'EXERCISE'
  | 'SLEEP'
  | 'ACTIVITY_SUMMARY'
  | 'PHYSICAL_INFORMATION'
  | 'CONTINUOUS_HEART_RATE'
  | 'SLEEP_WISE_CIRCADIAN_BEDTIME'
  | 'SLEEP_WISE_ALERTNESS';

export const POLAR_EVENT_TYPES: PolarEventType[] = [
  'PING',
  'EXERCISE',
  'SLEEP',
  'ACTIVITY_SUMMARY',
  'PHYSICAL_INFORMATION',
  'CONTINUOUS_HEART_RATE',
  'SLEEP_WISE_CIRCADIAN_BEDTIME',
  'SLEEP_WISE_ALERTNESS',
];

export class WebhookEventDto {
  @Type(() => Date)
  @IsDate()
  timestamp!: Date;

  @IsEnum(POLAR_EVENT_TYPES)
  event!: PolarEventType;

  // Polar присылает user_id числом, но для надёжности приводим к строке.
  @IsOptional()
  @Type(() => String)
  @IsString()
  user_id?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  entity_id?: string;

  @IsOptional()
  @IsUrl()
  url?: string;
}
