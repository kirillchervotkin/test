import { Module } from '@nestjs/common';
import { CITY_SERVICE } from './tokens.js';
import { CityController } from './city.controller.js';
import { TypeOrmCityService } from './city.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  controllers: [CityController],
  imports: [
    AuthModule, // для JWT-защиты
  ],
  providers: [
    {
      provide: CITY_SERVICE,
      useClass: TypeOrmCityService,
    },
  ],
  exports: [CITY_SERVICE],
})
export class CityModule {}
