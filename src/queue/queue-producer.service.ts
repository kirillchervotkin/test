// queue/queue-producer.service.ts
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 * Формирует тело сообщения в виде API Gateway envelope — точно так же,
 * как это сделал бы API Gateway при получении реального Polar-вебхука.
 *
 * ВАЖНО: НЕ оборачиваем в trigger envelope
 * (`{ event_metadata, details.message.body }`) — этот слой создаёт
 * сам Yandex MQ при доставке сообщения в serverless-контейнер.
 * Если положить его в очередь вручную, получится двойная обёртка,
 * и WebhookController не сможет распарсить сообщение.
 *
 * Структура очереди (от внешнего к внутреннему):
 *   1. YMQ trigger envelope  ← создаёт Yandex MQ при доставке
 *      { messages: [{ event_metadata, details: { message: { body } } }] }
 *   2. details.message.body = API Gateway envelope (мы кладём сюда)
 *      { httpMethod, headers, body: "<строка polarEvent>" }
 *   3. body = Polar-вебхук
 *      { event, user_id, entity_id, timestamp, url }
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
   * MessageBody = API Gateway envelope. Yandex MQ сам обернёт его
   * в trigger envelope при доставке.
   */
  async sendPolarWebhook(event: PolarWebhookEvent): Promise<void> {
    // Уровень 2: тело Polar-вебхука — строка
    const polarBody = JSON.stringify(event);

    // Уровень 1: envelope API Gateway — как его положил бы API Gateway.
    // Именно это кладём в MessageBody. Trigger envelope НЕ добавляем —
    // его создаст Yandex MQ сам.
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

    try {
      await this.sqs.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          // MessageBody — только API Gateway envelope.
          // Yandex MQ добавит { messages: [{ event_metadata, details: ... }] } сам.
          MessageBody: JSON.stringify(apiGatewayEnvelope),
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
