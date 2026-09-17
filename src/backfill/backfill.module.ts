// backfill/backfill.module.ts
import { Module } from '@nestjs/common';
import { PolarApiModule } from '../polar-api/polar-api.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { BackfillService } from './backfill.service.js';

@Module({
  imports: [PolarApiModule, QueueModule],
  providers: [BackfillService],
  exports: [BackfillService],
})
export class BackfillModule {}
