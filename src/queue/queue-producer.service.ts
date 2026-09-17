// queue/queue-producer.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  SendMessageCommand,
  SQSClient,
  type SQSClientConfig,
} from '@aws-sdk/client-sqs';

/**
 * События Polar, которые можно положить в очередь.
 * Совпадает с форматом, который Polar присылает через свой вебхук.
 */
export interface PolarWebhookEvent {
  event:
    | 'EXERCISE'
    | 'SLEEP'
    | 'ACTIVITY_SUMMARY'
    | 'PHYSICAL_INFORMATION'
    | 'PING';
  user_id: number;
  entity_id?: string;
  timestamp: string;
  url?: string;
}

/**
 * Единое место записи сообщений в Yandex Message Queue.
 *
 * Формирует точно такой же конверт, какой создаёт Yandex API Gateway
 * при получении реального Polar-вебхука. Это гарантирует, что
 * WebhookController распакует сообщение одинаково независимо от источника:
 *   - реальный вебхук от Polar (через API Gateway);
 *   - backfill при OAuth-связывании;
 *   - ручной reprocess из admin-эндпоинта.
 */
@Injectable()
export class QueueProducerService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueProducerService.name);
  private readonly sqs: SQSClient;
  private readonly queueUrl: string;
  private readonly queueArn: string;

  constructor(private readonly config: ConfigService) {
    const sqsConfig: SQSClientConfig = {
      region: this.config.get<string>('YC_REGION', 'ru-central1'),
      endpoint: this.config.getOrThrow<string>('YC_MQ_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('YC_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('YC_SECRET_ACCESS_KEY'),
      },
    };

    this.sqs = new SQSClient(sqsConfig);
    this.queueUrl = this.config.getOrThrow<string>('YC_QUEUE_URL');
    this.queueArn = this.config.get<string>('YC_QUEUE_ARN') ?? this.queueUrl;
  }

  onModuleDestroy(): void {
    this.sqs.destroy();
  }

  /**
   * Кладёт в очередь Polar-вебхук в формате, идентичном тому,
   * что создаёт Yandex API Gateway из реального запроса Polar.
   *
   * Структура (от внешнего к внутреннему):
   *   1. Trigger envelope  — { event_metadata, details }
   *   2. details.message.body = JSON.stringify(apiGatewayEnvelope)
   *   3. apiGatewayEnvelope.body = JSON.stringify(polarEvent)
   *
   * WebhookController делает ровно два JSON.parse, чтобы добраться
   * до polarEvent.
   */
  async sendPolarWebhook(event: PolarWebhookEvent): Promise<void> {
    // Уровень 3: тело Polar-вебхука — строка
    const polarBody = JSON.stringify(event);

    // Уровень 2: envelope API Gateway — как его положил бы API Gateway
    const apiGatewayEnvelope = {
      httpMethod: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Polar-Webhook-Event': event.event,
      },
      multiValueHeaders: {
        'Content-Type': ['application/json'],
        'Polar-Webhook-Event': [event.event],
      },
      queryStringParameters: {},
      multiValueQueryStringParameters: {},
      pathParameters: {},
      body: polarBody,
      isBase64Encoded: false,
      resource: '/polar-webhook',
      path: '/polar-webhook',
    };

    // Уровень 1: envelope Yandex Cloud Trigger
    const triggerEnvelope = {
      event_metadata: {
        event_id: randomUUID(),
        event_type: 'yandex.cloud.events.messagequeue.QueueMessage',
        created_at: new Date().toISOString(),
      },
      details: {
        queue_id: this.queueArn,
        message: {
          message_id: randomUUID(),
          body: JSON.stringify(apiGatewayEnvelope),
          attributes: {},
        },
      },
    };

    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(triggerEnvelope),
        }),
      );

      this.logger.debug(
        `Enqueued ${event.event} for user ${event.user_id}` +
          (event.entity_id ? ` entity ${event.entity_id}` : ''),
      );
    } catch (err: unknown) {
      this.logger.error(
        `Failed to enqueue ${event.event} for user ${event.user_id}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  /**
   * Пакетная постановка в очередь. Полезно для backfill, когда
   * тренировок десятки. Ошибка на одной не роняет остальные —
   * возвращает количество успешно поставленных.
   */
  async sendPolarWebhooksBatch(events: PolarWebhookEvent[]): Promise<number> {
    let success = 0;

    for (const event of events) {
      try {
        await this.sendPolarWebhook(event);
        success++;
      } catch {
        // уже залогировано внутри sendPolarWebhook
      }
    }

    this.logger.log(
      `Batch enqueue: ${success}/${events.length} message(s) sent`,
    );
    return success;
  }
}
