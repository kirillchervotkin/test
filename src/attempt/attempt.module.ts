// src/attempts/attempts.module.ts

import { Module } from '@nestjs/common';
import { AttemptController } from './attempt.controller.js';
import { AttemptService } from './attempt.service.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AttemptYdbRepository } from './attempt.repository.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [AttemptController],
  providers: [AttemptService, AttemptYdbRepository],
  exports: [AttemptService],
})
export class AttemptsModule {}
