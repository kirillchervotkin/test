// user.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserController } from './user.controller.js';
import { ListModule } from '../list/list.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UserYdbRepository } from './user.repository.js';

@Module({
  imports: [ListModule, forwardRef(() => AuthModule)],
  providers: [UserService, UserYdbRepository],
  exports: [UserService, UserYdbRepository], // репозиторий экспортируем, если понадобится в других модулях
  controllers: [UserController],
})
export class UserModule {}
