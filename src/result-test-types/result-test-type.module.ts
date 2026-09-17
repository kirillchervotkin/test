// src/result-test-types/result-test-type.module.ts

import { Module } from '@nestjs/common';
import { ResultTestTypeService } from './result-test-type.service.js';
import { ResultTestTypeRepository } from './repository/result-test-type.repository.js';
import { ResultTestTypeController } from './result-test-type.controller.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [ResultTestTypeController],
  providers: [ResultTestTypeService, ResultTestTypeRepository],
  exports: [ResultTestTypeService, ResultTestTypeRepository],
})
export class ResultTestTypeModule {}
