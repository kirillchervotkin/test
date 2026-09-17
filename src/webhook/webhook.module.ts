import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller.js';
import { WebhookService } from './webhook.service.js';
import { PolarApiModule } from '../polar-api/polar-api.module.js';
import { OauthModule } from '../oauth/oauth.module.js';

@Module({
  imports: [PolarApiModule, OauthModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
