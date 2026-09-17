import { Module } from '@nestjs/common';
import { MatchController } from './match.controller.js';
import { InMemoryMatchService } from './inMemoryMatch.service.js';
import { MATCHES_SERVICE } from './tokens.js';

@Module({
  controllers: [MatchController],
  providers: [
    {
      provide: MATCHES_SERVICE,
      useClass: InMemoryMatchService,
    },
  ],
  exports: [MATCHES_SERVICE],
})
export class MatchModule {}
