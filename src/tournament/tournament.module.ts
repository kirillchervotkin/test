import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ScheduleDomainModule } from '../schedule/schedule-domain.module.js';
import { TournamentController } from '../schedule/schedule.controllers.js';
@Module({
  imports: [AuthModule, ScheduleDomainModule],
  controllers: [TournamentController],
  exports: [ScheduleDomainModule],
})
export class TournamentModule {}
