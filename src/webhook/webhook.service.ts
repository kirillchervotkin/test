import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PolarApiService } from '../polar-api/polar-api.service.js';
import { OAuthTokenService } from '../oauth/oauthTokenService.service.js';
//import { TrainingSessionDto } from '../polar-api/dto/trainingSession.dto';
//import { PolarCardioLoadDto } from '../polar-api/dto/polarCardioLoad.dto';

@Injectable()
export class WebhookService {
  constructor(
    @Inject() private readonly polarApiService: PolarApiService,
    @Inject() private readonly oAuthTokenService: OAuthTokenService,
  ) {}
  async handleWebhook(
    polarUserId: string,
    //  exerciseId: string,
    //  date: Date,
  ): Promise<void> {
    const userId: string | null =
      await this.oAuthTokenService.getUserIdByExternalUserId(
        polarUserId,
        'polar',
      );
    if (!userId) {
      throw new NotFoundException('User Id not found');
    }
    const accessToken: string | null =
      await this.oAuthTokenService.getAccessToken(userId, 'polar');

    if (!accessToken) {
      throw new NotFoundException('Access Token not found');
    }

    /*
       const cardioLoad: PolarCardioLoadDto[] =
    await this.polarApiService.getCardioLoadByDate(accessToken, date, date);

       await this.cardioLoadService.upsertCardioLoadsFromPolar(userId, cardioLoad);

    const exercise: TrainingSessionDto =
      await this.polarApiService.getExerciseById(
        exerciseId,
        { zones: true },
        accessToken,
      );

    await this.exerciseService.upsertExercises(userId, [exercise]);
*/
  }
}
