import { CreateAttemptDto } from './dto/create-attempt.dto.js';
import { AttemptResponseDto } from './dto/response.dto.js';
import { UpdateAttemptDto } from './dto/update-attempt.dto.js';
import {
  Attempt,
  CreateAttemptData,
  UpdateAttemptData,
} from './entities/attempt.types.js';

export class AttemptMapper {
  static toCreateAttemptData(dto: CreateAttemptDto): CreateAttemptData {
    return {
      userId: dto.userId,
      testType: dto.testType,
      attemptNumber: dto.attemptNumber,
      testDate: new Date(dto.testDate),
      trainingCampId: dto.trainingCampId,
    };
  }

  static toUpdateAttemptData(
    id: string,
    dto: UpdateAttemptDto,
  ): UpdateAttemptData {
    const data: UpdateAttemptData = { id };
    if (dto.userId !== undefined) data.userId = dto.userId;
    if (dto.testType !== undefined) data.testType = dto.testType;
    if (dto.attemptNumber !== undefined) data.attemptNumber = dto.attemptNumber;
    if (dto.testDate !== undefined) data.testDate = new Date(dto.testDate);
    if (dto.trainingCampId !== undefined)
      data.trainingCampId = dto.trainingCampId;
    return data;
  }

  static toDto(attempt: Attempt): AttemptResponseDto {
    return {
      id: attempt.id,
      userId: attempt.userId,
      testType: attempt.testType,
      attemptNumber: attempt.attemptNumber,
      testDate: attempt.testDate.toISOString(),
      trainingCampId: attempt.trainingCampId,
    };
  }
}
