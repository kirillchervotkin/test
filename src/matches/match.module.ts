// src/matches/match.module.ts

import { Module } from '@nestjs/common';
import { MatchController } from './match.controller.js';
import { MatchService } from './match.service.js';
import { MatchRepository } from './repository/match.repository.js';
import { MATCHES_SERVICE } from './tokens.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    YdbModule, // даёт DRIZZLE для MatchRepository
    AuthModule, // для JWT-защиты
  ],
  controllers: [MatchController],
  providers: [
    MatchRepository,
    {
      provide: MATCHES_SERVICE,
      useClass: MatchService,
    },
  ],
  exports: [MATCHES_SERVICE],
})
export class MatchModule {}
