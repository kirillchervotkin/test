// anthropometry.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { AnthropometryService } from './anthropometry.service.js';
import { AnthropometryController } from './anthropometry.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [AnthropometryService],
  controllers: [AnthropometryController],
  exports: [AnthropometryService],
})
export class AnthropometryModule {}
