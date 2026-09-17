import { Module } from '@nestjs/common';
import { PolarApiService } from './polar-api.service.js';

@Module({
  providers: [PolarApiService],
  exports: [PolarApiService],
})
export class PolarApiModule {}
