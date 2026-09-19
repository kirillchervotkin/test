// src/webhook/webhook.controller.ts

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';

import { WebhookService } from './webhook.service.js';
import { TriggerPayloadDto } from '../trigger/dto/trigger-payload.dto.js';

/**
 * HTTP-точка входа для вебхуков.
 *
 * Контроллер намеренно тонкий: единственная задача — принять
 * POST с trigger payload и делегировать в WebhookService.
 *
 * Вся логика (разворачивание обёрток, валидация Polar-payload,
 * диспатч по типу события, сохранение тренировок) живёт в
 * сервисе. Это даёт:
 *   - возможность переиспользовать обработку из других мест
 *     (например, из cron'а или admin-эндпоинта) без HTTP;
 *   - простоту тестирования: сервис тестируется без поднятия
 *     HTTP-слоя, контроллер — без моков всей бизнес-логики;
 *   - контроллер можно менять (добавлять версионирование,
 *     auth-guard'ы), не задевая обработку.
 *
 * Валидация TriggerPayloadDto происходит автоматически через
 * глобальный ValidationPipe: если прилетит мусор вместо YMQ-
 * envelope, Nest вернёт 400 до вызова метода.
 */
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Приём trigger payload из Yandex Message Queue.
   *
   * Всегда возвращает 200 (даже если внутри что-то упало),
   * потому что иначе YMQ будет ретраить сообщение и может
   * накрутить бесконечный цикл на битом payload'е. Ошибки
   * обработки логируются в сервисе, а не пробрасываются
   * как HTTP-ошибки.
   *
   * Сама сигнатура метода вернёт 200 через @HttpCode, потому
   * что никаких исключений он не пробрасывает — всё внутри
   * сервиса обёрнуто в try/catch.
   */
  @HttpCode(HttpStatus.OK)
  @Post()
  async handleWebhook(@Body() body: TriggerPayloadDto): Promise<void> {
    await this.webhookService.handleTriggerPayload(body);
  }
}
