import { Module } from '@nestjs/common';
import { InMemoryRoleService } from './inMemoryRole.service.js';
import { RoleController } from './role.controller.js';
import { ROLE_SERVICE } from './tokens.js';

@Module({
  providers: [
    {
      provide: ROLE_SERVICE,
      useClass: InMemoryRoleService,
    },
  ],
  controllers: [RoleController],
  exports: [ROLE_SERVICE],
})
export class RoleModule {}
