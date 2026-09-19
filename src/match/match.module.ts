import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ScheduleDomainModule } from '../schedule/schedule-domain.module.js';
import { MatchController } from '../schedule/schedule.controllers.js';
@Module({
  imports: [AuthModule, ScheduleDomainModule],
  controllers: [MatchController],
  exports: [ScheduleDomainModule],
})
export class MatchModule {}
