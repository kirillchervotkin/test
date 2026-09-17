// src/camp-participant/mappers/camp-participant.mapper.ts

import { UpdateBibDto } from '../dto/update-bib.dto.js';
import {
  CampUserDto,
  CampParticipationDto,
} from '../dto/camp-participant-response.dto.js';
import {
  CampParticipant,
  CampParticipantWithUser,
} from '../entities/types/camp-participant.types.js';

export class CampParticipantMapper {
  /**
   * Формирует данные для обновления bib.
   * campId и userId приходят из параметров URL, dto.bib – из тела запроса.
   */
  static toUpdateBibData(
    campId: string,
    userId: string,
    dto: UpdateBibDto,
  ): Pick<CampParticipant, 'campId' | 'userId' | 'bib'> {
    return {
      campId,
      userId,
      bib: dto.bib,
    };
  }

  /**
   * Преобразует расширенную сущность (участник + данные пользователя) в DTO пользователя с bib.
   * Используется для ответов, содержащих полные данные пользователя.
   */
  static toUserDto(participant: CampParticipantWithUser): CampUserDto {
    return {
      id: participant.userId,
      firstName: participant.user.firstName,
      lastName: participant.user.lastName,
      email: participant.user.email,
      bib: participant.bib,
    };
  }

  /**
   * Массовое преобразование массива расширенных сущностей в массив CampUserDto.
   */
  static toUserDtoList(participants: CampParticipantWithUser[]): CampUserDto[] {
    return participants.map((p) => this.toUserDto(p));
  }

  /**
   * Преобразует базовую сущность участника (без данных пользователя) в DTO участия.
   * Используется для получения списка лагерей, где участвует пользователь.
   */
  static toCampParticipationDto(
    participant: CampParticipant,
  ): CampParticipationDto {
    return {
      campId: participant.campId,
      bib: participant.bib,
    };
  }

  /**
   * Массовое преобразование массива базовых сущностей в массив CampParticipationDto.
   */
  static toCampParticipationDtoList(
    participants: CampParticipant[],
  ): CampParticipationDto[] {
    return participants.map((p) => this.toCampParticipationDto(p));
  }
}
