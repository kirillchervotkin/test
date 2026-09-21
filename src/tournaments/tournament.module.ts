// src/tournaments/tournament.module.ts

import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller.js';
import { TournamentService } from './tournament.service.js';
import { TournamentRepository } from './repository/tournament.repository.js';
import { TOURNAMENTS_SERVICE } from './tokens.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    YdbModule, // даёт DRIZZLE для TournamentRepository
    AuthModule, // для JWT-защиты
  ],
  controllers: [TournamentController],
  providers: [
    TournamentRepository,
    {
      provide: TOURNAMENTS_SERVICE,
      useClass: TournamentService,
    },
  ],
  exports: [TOURNAMENTS_SERVICE],
})
export class TournamentModule {}
