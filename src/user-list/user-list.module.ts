import { UserListService } from './user-list.service.js';
import { UserListYdbRepository } from './user-list.ydb.repository.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserListController } from './user-list.controller.js';
import { Module } from '@nestjs/common';
import { ListUsersController } from './list-users.controller.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [UserListController, ListUsersController],
  providers: [UserListService, UserListYdbRepository],
  exports: [UserListService],
})
export class UserListModule {}
