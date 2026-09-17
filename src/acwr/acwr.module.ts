import { Module } from '@nestjs/common';
import { AcwrService } from './acwr.service.js';

@Module({
  providers: [AcwrService],
  exports: [AcwrService],
})
export class AcwrModule {}
