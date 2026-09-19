// src/webhook/webhook.module.ts

import { Module } from '@nestjs/common';

import { WebhookController } from './webhook.controller.js';
import { WebhookService } from './webhook.service.js';
import { OauthModule } from '../oauth/oauth.module.js';
import { PolarApiModule } from '../polar-api/polar-api.module.js';
import { TrainingModule } from '../training/training.module.js';

/**
 * Модуль приёма вебхуков Polar.
 *
 * Принимает сообщения из Yandex Message Queue (через trigger
 * или эмулятор), разворачивает вложенные обёртки, валидирует
 * payload и передаёт в WebhookService.
 *
 * Зависимости:
 *   - OauthModule     — OAuthTokenService: резолв внутреннего
 *                       userId по polar-user-id из payload
 *                       и получение access token пользователя;
 *   - PolarApiModule  — PolarApiService: запрос полной
 *                       тренировки из Polar (getExercise);
 *   - TrainingModule  — TrainingService (идемпотентное сохранение
 *                       тренировки + сэмплов) и PolarAdapter
 *                       (маппинг Polar v3 → канонические типы
 *                       Arbitrator).
 *
 * WebhookService не создаёт ничего через new: все зависимости
 * приходят через DI.
 */
@Module({
  imports: [OauthModule, PolarApiModule, TrainingModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
