// trigger/trigger.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TriggerEmulatorService } from './trigger-emulator.service.js';

/**
 * Модуль dev-эмулятора Yandex Cloud Trigger.
 *
 * Сервис сам читает конфиг из ConfigService и стартует только если
 * ENABLE_TRIGGER_EMULATOR === 'true', поэтому модуль безопасно
 * подключать в любом окружении — в проде он просто ничего не делает.
 *
 * Пример подключения в AppModule:
 *
 *   @Module({
 *     imports: [
 *       ConfigModule.forRoot({ isGlobal: true }),
 *       TriggerModule,
 *       // ...
 *     ],
 *   })
 *   export class AppModule {}
 *
 * Обязательные переменные окружения (читаются через getOrThrow):
 *   YC_MQ_ENDPOINT
 *   YC_ACCESS_KEY_ID
 *   YC_SECRET_ACCESS_KEY
 *   YC_QUEUE_URL
 *   TRIGGER_TARGET_URL
 *
 * Опциональные:
 *   YC_REGION                  (default: ru-central1)
 *   YC_QUEUE_ARN               (default: значение YC_QUEUE_URL)
 *   TRIGGER_TARGET_AUTH_HEADER (формат "Header-Name: value")
 *   TRIGGER_BATCH_SIZE         (default: 1)
 *   TRIGGER_VISIBILITY_TIMEOUT (default: 60)
 *   TRIGGER_WAIT_TIME          (default: 20)
 *   TRIGGER_TIMEOUT_MS         (default: 30000)
 *   ENABLE_TRIGGER_EMULATOR    ('true' включает эмулятор)
 */
@Module({
  imports: [ConfigModule],
  providers: [TriggerEmulatorService],
  exports: [TriggerEmulatorService],
})
export class TriggerModule {}
