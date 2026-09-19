import { CityRepository } from './repository/city.repository.js';
import { ScheduleRepository } from '../schedule/repository/schedule.repository.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { Module } from '@nestjs/common';
import { CITY_SERVICE } from './tokens.js';
import { CityController } from './city.controller.js';
import { YdbCityService } from './city.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  controllers: [CityController],
  imports: [
    YdbModule,
    AuthModule, // для JWT-защиты
  ],
  providers: [
    ScheduleRepository,
    CityRepository,
    {
      provide: CITY_SERVICE,
      useClass: YdbCityService,
    },
  ],
  exports: [CITY_SERVICE],
})
export class CityModule {}
