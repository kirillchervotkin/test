// webhook/webhook.controller.ts
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WebhookService } from './webhook.service.js';
import { WebhookEventDto } from './dto/webhookEvent.dto.js';
import { TriggerPayloadDto } from '../trigger/dto/trigger-payload.dto.js';

/**
 * Envelope API Gateway — то, что API Gateway положил в очередь.
 * Внутри поле `body` — СТРОКА с Polar-вебхуком.
 */
interface ApiGatewayEnvelope {
  httpMethod?: string;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(@Inject() private readonly webhookService: WebhookService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async handleWebhook(@Body() body: TriggerPayloadDto): Promise<void> {
    this.logger.debug(`Received ${body.messages.length} trigger message(s)`);

    for (const msg of body.messages) {
      const messageId = msg.details.message.message_id;

      // 1-й parse: строка → envelope API Gateway
      let envelope: ApiGatewayEnvelope;
      try {
        envelope = JSON.parse(msg.details.message.body) as ApiGatewayEnvelope;
      } catch (err: unknown) {
        this.logger.error(
          `[${messageId}] Failed to parse API Gateway envelope`,
          err instanceof Error ? err.stack : String(err),
        );
        continue;
      }

      // 2-й parse: envelope.body (строка) → Polar-вебхук
      let rawPolar: unknown;
      try {
        rawPolar =
          typeof envelope.body === 'string'
            ? JSON.parse(envelope.body)
            : envelope.body;
      } catch (err: unknown) {
        this.logger.error(
          `[${messageId}] Failed to parse Polar webhook from envelope.body`,
          err instanceof Error ? err.stack : String(err),
        );
        continue;
      }

      // Валидация Polar-вебхука
      const polarEvent = plainToInstance(WebhookEventDto, rawPolar);
      const errors = await validate(polarEvent, {
        whitelist: true,
        forbidNonWhitelisted: false,
      });

      if (errors.length > 0) {
        this.logger.error(
          `[${messageId}] Polar webhook validation failed. ` +
            `Raw: ${JSON.stringify(rawPolar)}`,
        );
        this.logger.error(
          `[${messageId}] Errors: ${errors
            .map((e) => Object.keys(e.constraints ?? {}).join(','))
            .join('; ')}`,
        );
        continue;
      }

      try {
        await this.processEvent(polarEvent, messageId);
      } catch {
        // Ignore failed events and continue processing the batch.
        continue;
      }
    }
  }

  private async processEvent(
    body: WebhookEventDto,
    messageId: string,
  ): Promise<void> {
    if (body.event === 'PING') {
      this.logger.log(`[${messageId}] PING received`);
      return;
    }

    if (body.event !== 'EXERCISE') {
      this.logger.warn(`[${messageId}] Unsupported event type: ${body.event}`);
      return;
    }

    if (!body.user_id) {
      throw new NotFoundException('User ID is required');
    }
    if (!body.entity_id) {
      throw new NotFoundException('Entity ID is required');
    }

    await this.webhookService.handleWebhook(body.user_id);
  }
}
