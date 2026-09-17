import { Module } from '@nestjs/common';
import { TournamentController } from './tournament.controller.js';
import { TOURNAMENTS_SERVICE } from './tokens.js';
import { TypeOrmTournamentsService } from './tournament.service.js';

@Module({
  providers: [
    {
      provide: TOURNAMENTS_SERVICE,
      useClass: TypeOrmTournamentsService,
    },
  ],
  controllers: [TournamentController],
  exports: [TOURNAMENTS_SERVICE],
})
export class TournamentModule {}
