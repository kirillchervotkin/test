import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtConfig } from './interfaces/jwtConfig.interface.js';
import { UserModule } from '../user/user.module.js';
import { JwtAuthGuard } from './guards/auth.guard.js';

@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow('ACCESS_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    JwtAuthGuard,
    AuthService,
    {
      provide: 'FRONTEND_URL',
      useFactory: (configService: ConfigService): string =>
        configService.getOrThrow('FRONTEND_URL'),
      inject: [ConfigService],
    },
    {
      provide: 'JWT_CONFIG',
      useFactory: (configService: ConfigService): JwtConfig => ({
        accessSecret: configService.getOrThrow('ACCESS_SECRET'),
        accessExpiration: configService.getOrThrow('ACCESS_EXPIRATION'),
        refreshSecret: configService.getOrThrow('REFRESH_SECRET'),
        refreshExpiration: configService.getOrThrow('REFRESH_EXPIRATION'),
      }),
      inject: [ConfigService],
    },
  ],
  exports: ['JWT_CONFIG', JwtAuthGuard],
})
export class AuthModule {}
