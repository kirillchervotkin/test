// src/fieldRole/field-role.module.ts

import { Module } from '@nestjs/common';
import { FieldRoleController } from './fieldRole.controller.js';
import { FieldRoleService } from './fieldRole.service.js';
import { FieldRoleRepository } from './repository/field-role.repository.js';
import { FieldRoleSeeder } from './field-role.seeder.js';
import { FIELD_ROLES_SERVICE } from './tokens.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    YdbModule, // даёт DRIZZLE для FieldRoleRepository
    AuthModule, // для JWT-защиты
  ],
  controllers: [FieldRoleController],
  providers: [
    FieldRoleRepository,
    FieldRoleSeeder, // срабатывает в dev через OnModuleInit
    {
      provide: FIELD_ROLES_SERVICE,
      useClass: FieldRoleService,
    },
  ],
  exports: [FIELD_ROLES_SERVICE],
})
export class FieldRoleModule {}
