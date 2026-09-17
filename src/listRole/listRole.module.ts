import { Module } from '@nestjs/common';
import { ListModule } from 'src/list/list.module.js';
import { RoleModule } from 'src/role/role.module.js';
import { ListRoleController } from './listRole.controller.js';
import { LIST_ROLE_SERVICE } from './tokents.js';
import { InMemoryListRoleService } from './inMemoryListRole.service.js';

@Module({
  imports: [RoleModule, ListModule],
  controllers: [ListRoleController],
  providers: [
    {
      provide: LIST_ROLE_SERVICE,
      useClass: InMemoryListRoleService,
    },
  ],
  exports: [LIST_ROLE_SERVICE],
})
export class ListRoleModule {}
