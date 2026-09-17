// src/modules/training-camps/training-camps.module.ts

import { Module } from '@nestjs/common';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TrainingCampController } from './training-camp.controller.js';
import { TrainingCampService } from './training-camp.service.js';
import { TrainingCampYdbRepository } from './training-camp.repository.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [TrainingCampController],
  providers: [TrainingCampService, TrainingCampYdbRepository],
  exports: [TrainingCampService],
})
export class TrainingCampsModule {}
