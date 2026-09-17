// src/test-grades/test-grade.module.ts

import { Module } from '@nestjs/common';
import { TestGradeService } from './test-grade.service.js';
import { TestGradeYdbRepository } from './repository/test-grade.ydb.repository.js';
import { TestGradeController } from './test-grade.controller.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [TestGradeController],
  providers: [TestGradeService, TestGradeYdbRepository],
  exports: [TestGradeService],
})
export class TestGradesModule {}
