import { forwardRef, Module } from '@nestjs/common';
import { ListService } from './list.service.js';
import { ListController } from './list.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { ListYdbRepository } from './list.ydb.repository.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [ListService, ListYdbRepository],
  controllers: [ListController],
  exports: [ListService],
})
export class ListModule {}
