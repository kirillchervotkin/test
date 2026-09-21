// src/stages/stage.module.ts

import { Module } from '@nestjs/common';
import { StageController } from './stage.controller.js';
import { StageService } from './stage.service.js';
import { StageRepository } from './repository/stage.repository.js';
import { STAGES_SERVICE } from './tokens.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    YdbModule, // даёт DRIZZLE для StageRepository
    AuthModule, // для JWT-защиты
  ],
  controllers: [StageController],
  providers: [
    StageRepository,
    {
      provide: STAGES_SERVICE,
      useClass: StageService,
    },
  ],
  exports: [STAGES_SERVICE],
})
export class StagesModule {}
