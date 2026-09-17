import { Module } from '@nestjs/common';
import { OauthController } from './oauth.controller.js';
import { OauthService } from './oauth.service.js';
import { ConfigService } from '@nestjs/config';
import { PolarConfig } from './interfaces/polarConfig.interface.js';
import { AuthModule } from '../auth/auth.module.js';
import { OAuthTokenService } from './oauthTokenService.service.js';
import { TokenEncryptionService } from './tokenEncryption.service.js';
import { OAuthTokenYdbRepository } from './oauth-token-ydb.repository.js';
import { PolarApiModule } from '../polar-api/polar-api.module.js';
import { UserModule } from '../user/user.module.js';
import { BackfillModule } from '../backfill/backfill.module.js';

@Module({
  imports: [AuthModule, PolarApiModule, UserModule, BackfillModule],
  controllers: [OauthController],
  providers: [
    OauthService,
    OAuthTokenService,
    TokenEncryptionService,
    OAuthTokenYdbRepository,
    {
      provide: 'ENCRYPTION_KEY',
      useFactory: (configService: ConfigService): string =>
        configService.getOrThrow('ENCRYPTION_KEY'),
      inject: [ConfigService],
    },
    {
      provide: 'OAUTH_POLAR_CONFIG',
      useFactory: (configService: ConfigService): PolarConfig => ({
        clientSecret: configService.getOrThrow('POLAR_CLIENT_SECRET'),
        clientId: configService.getOrThrow('POLAR_CLIENT_ID'),
        redirectUri: configService.getOrThrow('POLAR_REDIRECT_URL'),
        baseUrl: configService.getOrThrow('POLAR_BASE_URL'),
      }),
      inject: [ConfigService],
    },
  ],
  exports: [OauthService, OAuthTokenService, OAuthTokenYdbRepository],
})
export class OauthModule {}
