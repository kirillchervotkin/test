import { Module } from '@nestjs/common';
import { TeamController } from './team.controller.js';
import { TEAM_SERVICE } from './tokens.js';
import { TypeOrmTeamService } from './team.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  controllers: [TeamController],
  imports: [
    AuthModule, // для JWT-защиты
  ],
  providers: [
    {
      provide: TEAM_SERVICE,
      useClass: TypeOrmTeamService,
    },
  ],
  exports: [TEAM_SERVICE],
})
export class TeamModule {}
