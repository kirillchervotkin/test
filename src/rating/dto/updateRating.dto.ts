import { PartialType } from '@nestjs/swagger';
import { CreateRatingDto } from './createRating.dto.js';

export class UpdateRatingDto extends PartialType(CreateRatingDto) {}
