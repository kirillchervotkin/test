import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import Joi from 'joi';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserModule } from './user/user.module.js';
import { OauthModule } from './oauth/oauth.module.js';
import { CacheModule } from '@nestjs/cache-manager';
import { PolarApiModule } from './polar-api/polar-api.module.js';
import { AnthropometryModule } from './anthropometry/anthropometry.module.js';
import { ListModule } from './list/list.module.js';

import { WebhookModule } from './webhook/webhook.module.js';
import { AdminInitializationService } from './adminInit.service.js';
import { TournamentModule } from './tournament/tournament.module.js';
import { TeamModule } from './team/team.module.js';
import { CityModule } from './city/city.module.js';
import { GroupModule } from './group/group.module.js';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ValidationExceptionFilter } from './common/exceptionFilters/validationExceptionFilter.js';
import { ExceptionUtilsService } from './common/exceptionFilters/exception-utils.service.js';
import {
  AcceptLanguageResolver,
  I18nModule,
  i18nValidationErrorFactory,
} from 'nestjs-i18n';
import * as path from 'path';
import { StoreDtoValidationPipe } from './common/pipes/store-dto-validation.pipe.js';
import { MappingMiddleware } from './common/middlwares/mapping.middleware.js';
import { YdbModule } from './common/ydb/ydb.module.js';
import { DbConstraintExceptionFilter } from './common/exceptionFilters/dbConstraintExceptionFilter.js';
import { UserListModule } from './user-list/user-list.module.js';

// Определяем __dirname для ESM (исправление ReferenceError)
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { TrainingCampsModule } from './training_camp/training-camps.module.js';
import { AttemptsModule } from './attempt/attempt.module.js';
import { ReportModule } from './report/report.module.js';
import { ResultsModule } from './result/results.module.js';
import { TestTypesModule } from './training_camp/test-types.module.js';
import { QuestionnairesModule } from './questionnaires/questionnaires.module.js';
import { CampParticipantModule } from './camp_participant/camp-participant.module.js';
import { TestGradesModule } from './test-grades/test-grade.module.js';
import { TriggerModule } from './trigger/trigger.module.js';
import { QueueModule } from './queue/queue.module.js';
import { BackfillModule } from './backfill/backfill.module.js';
import { TrainingModule } from './training/training.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(process.cwd(), 'src', 'i18n'),
        watch: true,
      },
      resolvers: [new AcceptLanguageResolver()],
    }),
    ConfigModule.forRoot({
      cache: false,
      isGlobal: true,
      validationSchema: Joi.object({
        DB_USERNAME: Joi.string().required(),
        ACCESS_SECRET: Joi.string().required(),
        ACCESS_EXPIRATION: Joi.string().default('15m'),
        REFRESH_SECRET: Joi.string().required(),
        REFRESH_EXPIRATION: Joi.string().default('7d'),

        YDB_ENDPOINT: Joi.string()
          .uri({ scheme: 'grpcs' })
          .required()
          .description('YDB gRPC endpoint'),

        YDB_DATABASE: Joi.string()
          .pattern(/^\/ru-central1\/[a-z0-9]+\/[a-z0-9]+$/)
          .required()
          .description('YDB database path'),

        YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS: Joi.string().description(
          'Path to authorized key JSON file for YDB',
        ),

        POLAR_CLIENT_ID: Joi.string()
          .guid({ version: 'uuidv4' })
          .required()
          .description('Polar OAuth Client ID'),

        POLAR_CLIENT_SECRET: Joi.string()
          .guid({ version: 'uuidv4' })
          .required()
          .description('Polar OAuth Client Secret'),

        POLAR_REDIRECT_URL: Joi.string()
          .uri({ scheme: ['http', 'https'] })
          .required()
          .description('Polar OAuth Redirect URL'),

        POLAR_BASE_URL: Joi.string()
          .uri({ scheme: 'https' })
          .required()
          .description('Polar OAuth Authorization Endpoint'),

        FRONTEND_URL: Joi.string().required(),

        ENCRYPTION_KEY: Joi.string().required(),

        PORT: Joi.number().default(3000),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),

        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
      }),
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    OauthModule,
    UserModule,
    AuthModule,
    CacheModule.register({
      isGlobal: true,
      ttl: 5 * 60 * 1000,
    }),
    YdbModule,
    PolarApiModule,
    AnthropometryModule,
    ListModule,
    AnthropometryModule,
    WebhookModule,
    ReportModule,
    TournamentModule,
    TeamModule,
    CityModule,
    GroupModule,
    UserListModule,
    TrainingCampsModule,
    AttemptsModule,
    ResultsModule,
    TestTypesModule,
    QuestionnairesModule,
    CampParticipantModule,
    TestGradesModule,
    TriggerModule,
    QueueModule,
    BackfillModule,
    TrainingModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new StoreDtoValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          stopAtFirstError: false,
          transformOptions: {
            enableImplicitConversion: false,
          },
          exceptionFactory: i18nValidationErrorFactory,
        }),
      inject: [ExceptionUtilsService],
    },
    {
      provide: Logger,
      useValue: new Logger(),
    },
    ExceptionUtilsService,
    // ВАЖНО: порядок регистрации APP_FILTER влияет на порядок применения.
    // Фильтры применяются в порядке, обратном порядку объявления.
    // Чтобы ValidationExceptionFilter перехватывал I18nValidationException
    // до того, как его перехватит DbConstraintExceptionFilter (который ловит все ошибки),
    // мы должны объявить ValidationExceptionFilter ПОСЛЕДНИМ в этом списке.
    // Таким образом, он будет применён первым.
    {
      provide: APP_FILTER,
      useClass: DbConstraintExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: ValidationExceptionFilter, // Последний – применяется первым
    },
    AdminInitializationService,
    {
      provide: 'PORT',
      useFactory: (configService: ConfigService): number => {
        return configService.getOrThrow<number>('PORT');
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MappingMiddleware).forRoutes('*');
  }
}
