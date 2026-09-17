// src/results/results.module.ts

import { Module } from '@nestjs/common';
import { ResultService } from './result.service.js';
import { ResultYdbRepository } from './repository/result.repository.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ResultController } from './result.controller.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [ResultController],
  providers: [ResultService, ResultYdbRepository],
  exports: [ResultService],
})
export class ResultsModule {}
