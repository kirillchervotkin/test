// trigger/trigger-emulator.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import axios, { AxiosInstance } from 'axios';
import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
  type SQSClientConfig,
} from '@aws-sdk/client-sqs';

/**
 * DEV-ЭМУЛЯТОР Yandex Cloud Trigger для Message Queue.
 *
 * Читает сообщения из РЕАЛЬНОЙ очереди Yandex MQ и делает HTTP POST на
 * URL serverless-контейнера — точно так же, как это делает настоящий
 * триггер Yandex Cloud.
 *
 * Один и тот же сервис можно нацелить:
 *   - на локальный контейнер:   http://localhost:3000/trigger/message-queue
 *   - на удалённый serverless:  https://bba-xxx.containers.yandexcloud.net/trigger/message-queue
 *
 * Формат payload полностью совпадает с форматом триггера, поэтому
 * контроллер и бизнес-логика не знают, кто их вызвал — эмулятор или прод.
 */

interface TriggerPayload {
  messages: Array<{
    event_metadata: {
      event_id: string;
      event_type: 'yandex.cloud.events.messagequeue.QueueMessage';
      created_at: string;
    };
    details: {
      queue_id: string;
      message: {
        message_id: string;
        body: string;
        attributes: Record<string, string>;
      };
    };
  }>;
}

@Injectable()
export class TriggerEmulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TriggerEmulatorService.name);

  private readonly sqs: SQSClient;
  private readonly http: AxiosInstance;

  private readonly queueUrl: string;
  private readonly queueArn: string;
  private readonly targetUrl: string;
  private readonly batchSize: number;
  private readonly visibilityTimeout: number;
  private readonly waitTimeSeconds: number;
  private readonly authHeader?: string;

  private running = false;
  private loopPromise: Promise<void> | null = null;
  private activeController: AbortController | null = null;

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

    this.targetUrl = this.config.getOrThrow<string>('TRIGGER_TARGET_URL');
    this.authHeader = this.config.get<string>('TRIGGER_TARGET_AUTH_HEADER');

    this.batchSize = this.getNumber('TRIGGER_BATCH_SIZE', 1);
    this.visibilityTimeout = this.getNumber('TRIGGER_VISIBILITY_TIMEOUT', 60);
    this.waitTimeSeconds = this.getNumber('TRIGGER_WAIT_TIME', 20);

    this.http = axios.create({
      timeout: this.getNumber('TRIGGER_TIMEOUT_MS', 30_000),
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
  }

  onModuleInit(): void {
    const enabled =
      this.config.get<string>('ENABLE_TRIGGER_EMULATOR') === 'true';

    if (!enabled) {
      this.logger.log(
        'Trigger emulator disabled (ENABLE_TRIGGER_EMULATOR != true)',
      );
      return;
    }

    this.running = true;
    this.logger.log(
      `Trigger emulator started | queue=${this.queueUrl} | target=${this.targetUrl} | ` +
        `batch=${this.batchSize} | visibility=${this.visibilityTimeout}s`,
    );

    this.loopPromise = this.pollLoop();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.running) return;
    this.logger.log('Stopping trigger emulator...');
    this.running = false;

    this.activeController?.abort();

    if (this.loopPromise) {
      try {
        await this.loopPromise;
      } catch (err: unknown) {
        this.logger.error(
          'Trigger emulator loop terminated with error',
          this.describeError(err),
        );
      }
    }

    this.sqs.destroy();
    this.logger.log('Trigger emulator stopped');
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        this.activeController = new AbortController();

        const res = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: this.batchSize,
            WaitTimeSeconds: this.waitTimeSeconds,
            VisibilityTimeout: this.visibilityTimeout,
            MessageAttributeNames: ['All'],
            AttributeNames: ['All'],
          }),
          { abortSignal: this.activeController.signal },
        );

        this.activeController = null;

        const messages = res.Messages ?? [];
        if (messages.length === 0) continue;

        this.logger.debug(`Received ${messages.length} message(s)`);

        const payload: TriggerPayload = {
          messages: messages.map((m) => this.toTriggerMessage(m)),
        };

        const ok = await this.deliver(payload);
        if (!ok) {
          this.logger.warn(
            'Delivery failed, messages will return to queue after visibility timeout',
          );
          continue;
        }

        await this.deleteMessages(messages);
      } catch (err: unknown) {
        if (!this.running) break;
        if (this.isAbortError(err)) break;

        this.logger.error(
          'SQS poll error, retrying in 5s',
          this.describeError(err),
        );
        await this.sleep(5_000);
      } finally {
        this.activeController = null;
      }
    }
  }

  /**
   * Преобразует сообщение SQS в формат сообщения триггера Yandex Cloud.
   * Body передаётся СТРОКОЙ как есть — ровно так же, как у настоящего триггера.
   */
  private toTriggerMessage(m: Message): TriggerPayload['messages'][number] {
    return {
      event_metadata: {
        event_id: randomUUID(),
        event_type: 'yandex.cloud.events.messagequeue.QueueMessage',
        created_at: new Date().toISOString(),
      },
      details: {
        queue_id: this.queueArn,
        message: {
          message_id: m.MessageId ?? '',
          body: m.Body ?? '',
          attributes: this.normalizeAttributes(m),
        },
      },
    };
  }

  private normalizeAttributes(m: Message): Record<string, string> {
    const attrs: Record<string, string> = {};

    for (const [k, v] of Object.entries(m.Attributes ?? {})) {
      if (v != null) attrs[k] = String(v);
    }

    if (m.MessageAttributes && Object.keys(m.MessageAttributes).length > 0) {
      for (const [k, v] of Object.entries(m.MessageAttributes)) {
        attrs[`attr.${k}`] = v.StringValue ?? v.BinaryValue?.toString() ?? '';
      }
    }

    return attrs;
  }

  private async deliver(payload: TriggerPayload): Promise<boolean> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authHeader) {
      const idx = this.authHeader.indexOf(':');
      if (idx > 0) {
        headers[this.authHeader.slice(0, idx).trim()] = this.authHeader
          .slice(idx + 1)
          .trim();
      }
    }

    try {
      const res = await this.http.post<unknown>(this.targetUrl, payload, {
        headers,
      });

      if (res.status >= 200 && res.status < 300) {
        this.logger.debug(
          `Delivered ${payload.messages.length} message(s) → HTTP ${res.status}`,
        );
        return true;
      }

      this.logger.error(
        `Target responded HTTP ${res.status}: ${this.truncate(res.data)}`,
      );
      return false;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to deliver to ${this.targetUrl}`,
        this.describeError(err),
      );
      return false;
    }
  }

  private async deleteMessages(messages: Message[]): Promise<void> {
    await Promise.all(
      messages.map(async (m) => {
        if (!m.ReceiptHandle) return;

        try {
          await this.sqs.send(
            new DeleteMessageCommand({
              QueueUrl: this.queueUrl,
              ReceiptHandle: m.ReceiptHandle,
            }),
          );
          this.logger.debug(`Deleted message ${m.MessageId}`);
        } catch (err: unknown) {
          this.logger.warn(
            `Failed to delete message ${m.MessageId}, may be redelivered`,
            this.describeError(err),
          );
        }
      }),
    );
  }

  private isAbortError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const name = (err as { name?: string }).name;
    return (
      name === 'AbortError' ||
      name === 'RequestAbortedError' ||
      name === 'TimeoutError'
    );
  }

  private describeError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === 'string') return new Error(err);
    try {
      return new Error(JSON.stringify(err));
    } catch {
      return new Error('Non-serializable error');
    }
  }

  private truncate(data: unknown, max = 500): string {
    const s =
      typeof data === 'string'
        ? data
        : (() => {
            try {
              return JSON.stringify(data) ?? '';
            } catch {
              return String(data);
            }
          })();
    return s.length > max ? `${s.slice(0, max)}…` : s;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * @nestjs/config не конвертирует типы: значения из .env всегда строки.
   * Явный parseInt защищает от "1" + 1 = "11" в runtime.
   */
  private getNumber(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (raw == null || raw === '') return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
