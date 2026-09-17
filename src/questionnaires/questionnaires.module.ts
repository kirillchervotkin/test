// src/questionnaires/questionnaires.module.ts

import { Module } from '@nestjs/common';
import { QuestionnaireController } from './questionnaire.controller.js';
import { QuestionnaireService } from './questionnaire.service.js';
import { QuestionnaireRepository } from './repository/questionnaire.repository.js';
import { YdbModule } from '../common/ydb/ydb.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [YdbModule, AuthModule],
  controllers: [QuestionnaireController],
  providers: [QuestionnaireService, QuestionnaireRepository],
  exports: [QuestionnaireService],
})
export class QuestionnairesModule {}
