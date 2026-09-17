// queue/queue.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueProducerService } from './queue-producer.service.js';

@Module({
  imports: [ConfigModule],
  providers: [QueueProducerService],
  exports: [QueueProducerService],
})
export class QueueModule {}
