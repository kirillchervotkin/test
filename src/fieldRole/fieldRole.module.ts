import { Module } from '@nestjs/common';
import { FieldRoleController } from './fieldRole.controller.js';
import { InMemoryFieldRoleService } from './inMemoryFieldRole.service.js';
import { FIELD_ROLE_SERVICE } from './tokens.js';

@Module({
  controllers: [FieldRoleController],
  providers: [
    {
      provide: FIELD_ROLE_SERVICE,
      useClass: InMemoryFieldRoleService,
    },
  ],
  exports: [FIELD_ROLE_SERVICE],
})
export class FieldRoleModule {}
