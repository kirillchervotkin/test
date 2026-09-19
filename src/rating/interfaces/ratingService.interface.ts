import { CreateRatingDto } from '../dto/createRating.dto.js';
import { UpdateRatingDto } from '../dto/updateRating.dto.js';
import { RatingResponseDto } from '../dto/ratingResponse.dto.js';

export interface RatingService {
  // Создает новую оценку для указанного назначения
  create(
    assignmentId: number,
    createRatingDto: CreateRatingDto,
  ): Promise<RatingResponseDto>;

  // Полностью обновляет существующую оценку по её ID (заменяет все поля из CreateDto)
  update(id: number, createRatingDto: CreateRatingDto): RatingResponseDto;

  // Частично обновляет существующую оценку по её ID (только переданные поля)
  patch(id: number, updateRatingDto: UpdateRatingDto): RatingResponseDto;

  // Находит оценку по её ID
  findOne(id: number): RatingResponseDto;

  // Находит оценку по ID назначения
  findByAssignmentId(assignmentId: number): RatingResponseDto;

  // Удаляет оценку по её ID
  remove(id: number): { message: string };

  // Удаляет оценку по ID назначения
  removeByAssignmentId(assignmentId: number): { message: string };

  // Получает все оценки
  findAll(): RatingResponseDto[];

  // Получает все оценки для указанного назначения
  findAllByAssignmentId(assignmentId: number): RatingResponseDto[];

  // Получает все оценки для указанного пользователя
  findAllByUserId(userId: number): RatingResponseDto[];

  // Получает все оценки для указанного матча
  findAllByMatchId(matchId: string): RatingResponseDto[];
}
