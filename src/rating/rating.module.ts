import { Module } from '@nestjs/common';
import { RATINGS_SERVICE } from './tokens.js';
import { MatchModule } from '../match/match.module.js';
import { AssignmentsController } from 'src/assignment/assignment.controller.js';
import { RatingsController } from './rating.controller.js';
import { ASSIGNMENTS_SERVICE } from '../assignment/tokens.js';
import { InMemoryAssignmentService } from 'src/assignment/inMemoryAssignment.service.js';
import { InMemoryRatingService } from './inMemoryRating.service.js';

@Module({
  imports: [MatchModule],
  controllers: [AssignmentsController, RatingsController],
  providers: [
    {
      provide: ASSIGNMENTS_SERVICE,
      useClass: InMemoryAssignmentService,
    },
    {
      provide: RATINGS_SERVICE,
      useClass: InMemoryRatingService,
    },
  ],
  exports: [RATINGS_SERVICE],
})
export class RatingModule {}
