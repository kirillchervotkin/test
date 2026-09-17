import { forwardRef, Module } from '@nestjs/common';
import { GroupController } from './group.controller.js';
import { GROUP_SERVICE } from './tokens.js';
import { TypeOrmGroupsService } from './typeormGroups.service.js';
import { TournamentModule } from '../tournament/tournament.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [TournamentModule, forwardRef(() => AuthModule)],
  controllers: [GroupController],
  providers: [
    {
      provide: GROUP_SERVICE,
      useClass: TypeOrmGroupsService,
    },
  ],
  exports: [GROUP_SERVICE],
})
export class GroupModule {}
