import { Module } from '@nestjs/common';
import { FitnessReportController } from './report.controller.js';
import { ReportService } from './report.service.js';
import { ReportRepository } from './report.repository.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    YdbModule, // для работы с YDB через Drizzle
    AuthModule, // для JWT-защиты
  ],
  controllers: [FitnessReportController],
  providers: [ReportService, ReportRepository],
  exports: [ReportService],
})
export class ReportModule {}
