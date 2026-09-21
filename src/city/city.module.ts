// src/cities/city.module.ts

import { Module } from '@nestjs/common';
import { CityController } from './city.controller.js';
import { CityService } from './city.service.js';
import { CityRepository } from './repository/city.repository.js';
import { CITY_SERVICE } from './tokens.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    YdbModule, // даёт DRIZZLE для CityRepository
    AuthModule, // для JWT-защиты
  ],
  controllers: [CityController],
  providers: [
    CityRepository,
    {
      provide: CITY_SERVICE,
      useClass: CityService,
    },
  ],
  exports: [CITY_SERVICE],
})
export class CityModule {}
