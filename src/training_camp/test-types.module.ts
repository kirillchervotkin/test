// src/modules/test-types/test-types.module.ts

import { Module } from '@nestjs/common';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TestTypeController } from '../test-type/test-type.controller.js';
import { TestTypeService } from '../test-type/test-type.service.js';
import { TestTypeRepository } from '../test-type/test-type.repository.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [TestTypeController],
  providers: [TestTypeService, TestTypeRepository],
  exports: [TestTypeService],
})
export class TestTypesModule {}
