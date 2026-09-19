// src/training/training.module.ts

import { Module } from '@nestjs/common';

import { TrainingService } from './training.service.js';
import { TrainingRepository } from './repositories/training-session.repository.js';
import { SportTypeRepository } from './repositories/sport-type.repository.js';
import { PolarAdapter } from './adapters/polar.adapter.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { TrainingController } from './training.controller.js';
import { AuthModule } from '../auth/auth.module.js';

/**
 * Модуль тренировок.
 *
 * Объединяет три таблицы одного домена:
 *   - training_sessions — метаданные тренировки;
 *   - training_samples  — блобы сэмплов (hr, speed, power, ...);
 *   - sport_types       — справочник видов спорта.
 *
 * Провайдеры:
 *   - TrainingService     — фасад домена (публичный API модуля);
 *   - TrainingRepository  — тренировки + сэмплы (один агрегат);
 *   - SportTypeRepository — справочник (отдельная сущность);
 *   - PolarAdapter        — маппинг Polar v3 → канонические типы
 *                           Arbitrator (используется вебхуком
 *                           и backfill'ом).
 *
 * Экспортирует TrainingService, PolarAdapter и репозитории —
 * всё, что нужно другим модулям (WebhookModule, BackfillModule,
 * admin-модуль).
 *
 * Зависимости:
 *   - YdbModule — предоставляет DRIZZLE-провайдер для инжекта
 *     в репозитории. Импорт обязателен, иначе Nest не сможет
 *     разрешить зависимость `@Inject(DRIZZLE)` в конструкторах.
 */
@Module({
  imports: [YdbModule, AuthModule],
  controllers: [TrainingController],
  providers: [
    TrainingService,
    TrainingRepository,
    SportTypeRepository,
    PolarAdapter,
  ],
  exports: [
    TrainingService,
    PolarAdapter,
    // Репозитории экспонируются на случай, если снаружи нужен
    // доступ к отдельным операциям без прохода через сервис
    // (например, admin-модуль для массового переимпорта). Если
    // такого сценария нет — можно убрать и оставить только
    // TrainingService и PolarAdapter.
    TrainingRepository,
    SportTypeRepository,
  ],
})
export class TrainingModule {}
