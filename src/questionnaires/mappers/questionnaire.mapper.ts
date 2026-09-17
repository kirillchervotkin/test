// src/questionnaires/mappers/questionnaire.mapper.ts

import { CreateQuestionnaireDto } from '../dto/create-questionnaire.dto.js';
import { UpdateQuestionnaireDto } from '../dto/update-questionnaire.dto.js';
import { CreateQuestionnaireByEmailDto } from '../dto/create-by-email.dto.js';
import { QuestionnaireResponseDto } from '../dto/questionnaire-response.dto.js';
import { QuestionnaireBaseResponseDto } from '../dto/questionnaire-base-response.dto.js';
import {
  CreateQuestionnaireData,
  UpdateQuestionnaireData,
  QuestionnaireWithUser,
  Questionnaire,
} from '../entities/types/questionnaire.types.js';

export class QuestionnaireMapper {
  /**
   * Преобразует DTO создания (по userId) в данные для репозитория.
   * Все строки дат преобразуются в объекты Date или null.
   */
  static toCreateData(dto: CreateQuestionnaireDto): CreateQuestionnaireData {
    return {
      userId: dto.userId,
      sportsCategory: dto.sportsCategory ?? null,
      orderNumber: dto.orderNumber ?? null,
      assignmentDate: dto.assignmentDate ? new Date(dto.assignmentDate) : null,
      assigningAuthority: dto.assigningAuthority ?? null,
      isFifaJudge: dto.isFifaJudge ?? null,
      fifaId: dto.fifaId ?? null,
      hasVarLicense: dto.hasVarLicense ?? null,
      heightCm: dto.heightCm ?? null,
      jogelEquipmentSize: dto.jogelEquipmentSize ?? null,
      jogelShoeSize: dto.jogelShoeSize ?? null,
      citizenship: dto.citizenship ?? null,
      countryOfResidence: dto.countryOfResidence ?? null,
      passportType: dto.passportType ?? null,
      passportSeries: dto.passportSeries ?? null,
      passportNumber: dto.passportNumber ?? null,
      issuedBy: dto.issuedBy ?? null,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      departmentCode: dto.departmentCode ?? null,
      phone: dto.phone ?? null,
    };
  }

  /**
   * Преобразует массив DTO создания в массив данных для репозитория.
   */
  static toCreateManyData(
    dtos: CreateQuestionnaireDto[],
  ): CreateQuestionnaireData[] {
    return dtos.map((dto) => this.toCreateData(dto));
  }

  /**
   * Преобразует DTO создания по email (без userId) в данные для репозитория.
   */
  static toCreateDataFromEmail(
    dto: Omit<CreateQuestionnaireByEmailDto, 'email'>,
  ): Omit<CreateQuestionnaireData, 'userId'> {
    return {
      sportsCategory: dto.sportsCategory ?? null,
      orderNumber: dto.orderNumber ?? null,
      assignmentDate: dto.assignmentDate ? new Date(dto.assignmentDate) : null,
      assigningAuthority: dto.assigningAuthority ?? null,
      isFifaJudge: dto.isFifaJudge ?? null,
      fifaId: dto.fifaId ?? null,
      hasVarLicense: dto.hasVarLicense ?? null,
      heightCm: dto.heightCm ?? null,
      jogelEquipmentSize: dto.jogelEquipmentSize ?? null,
      jogelShoeSize: dto.jogelShoeSize ?? null,
      citizenship: dto.citizenship ?? null,
      countryOfResidence: dto.countryOfResidence ?? null,
      passportType: dto.passportType ?? null,
      passportSeries: dto.passportSeries ?? null,
      passportNumber: dto.passportNumber ?? null,
      issuedBy: dto.issuedBy ?? null,
      issueDate: dto.issueDate ? new Date(dto.issueDate) : null,
      departmentCode: dto.departmentCode ?? null,
      phone: dto.phone ?? null,
    };
  }

  /**
   * Преобразует DTO обновления в данные для репозитория.
   * userId передаётся отдельно (из параметра маршрута).
   */
  static toUpdateData(
    userId: string,
    dto: UpdateQuestionnaireDto,
  ): UpdateQuestionnaireData {
    const data: UpdateQuestionnaireData = { userId };
    if (dto.sportsCategory !== undefined)
      data.sportsCategory = dto.sportsCategory;
    if (dto.orderNumber !== undefined) data.orderNumber = dto.orderNumber;
    if (dto.assignmentDate !== undefined) {
      data.assignmentDate = dto.assignmentDate
        ? new Date(dto.assignmentDate)
        : null;
    }
    if (dto.assigningAuthority !== undefined)
      data.assigningAuthority = dto.assigningAuthority;
    if (dto.isFifaJudge !== undefined) data.isFifaJudge = dto.isFifaJudge;
    if (dto.fifaId !== undefined) data.fifaId = dto.fifaId;
    if (dto.hasVarLicense !== undefined) data.hasVarLicense = dto.hasVarLicense;
    if (dto.heightCm !== undefined) data.heightCm = dto.heightCm;
    if (dto.jogelEquipmentSize !== undefined)
      data.jogelEquipmentSize = dto.jogelEquipmentSize;
    if (dto.jogelShoeSize !== undefined) data.jogelShoeSize = dto.jogelShoeSize;
    if (dto.citizenship !== undefined) data.citizenship = dto.citizenship;
    if (dto.countryOfResidence !== undefined)
      data.countryOfResidence = dto.countryOfResidence;
    if (dto.passportType !== undefined) data.passportType = dto.passportType;
    if (dto.passportSeries !== undefined)
      data.passportSeries = dto.passportSeries;
    if (dto.passportNumber !== undefined)
      data.passportNumber = dto.passportNumber;
    if (dto.issuedBy !== undefined) data.issuedBy = dto.issuedBy;
    if (dto.issueDate !== undefined) {
      data.issueDate = dto.issueDate ? new Date(dto.issueDate) : null;
    }
    if (dto.departmentCode !== undefined)
      data.departmentCode = dto.departmentCode;
    if (dto.phone !== undefined) data.phone = dto.phone;
    return data;
  }

  /**
   * Преобразует сущность анкеты с данными пользователя в полный DTO ответа.
   * Даты преобразуются в строки формата YYYY-MM-DD.
   */
  static toDto(entity: QuestionnaireWithUser): QuestionnaireResponseDto {
    return {
      userId: entity.userId,
      sportsCategory: entity.sportsCategory,
      orderNumber: entity.orderNumber,
      assignmentDate:
        entity.assignmentDate instanceof Date
          ? entity.assignmentDate.toISOString().slice(0, 10)
          : null,
      assigningAuthority: entity.assigningAuthority,
      isFifaJudge: entity.isFifaJudge,
      fifaId: entity.fifaId,
      hasVarLicense: entity.hasVarLicense,
      heightCm: entity.heightCm,
      jogelEquipmentSize: entity.jogelEquipmentSize,
      jogelShoeSize: entity.jogelShoeSize,
      citizenship: entity.citizenship,
      countryOfResidence: entity.countryOfResidence,
      passportType: entity.passportType,
      passportSeries: entity.passportSeries,
      passportNumber: entity.passportNumber,
      issuedBy: entity.issuedBy,
      issueDate:
        entity.issueDate instanceof Date
          ? entity.issueDate.toISOString().slice(0, 10)
          : null,
      departmentCode: entity.departmentCode,
      phone: entity.phone,
      firstName: entity.firstName,
      lastName: entity.lastName,
      email: entity.email,
    };
  }

  /**
   * Преобразует массив сущностей с данными пользователя в массив полных DTO.
   */
  static toDtoArray(
    entities: QuestionnaireWithUser[],
  ): QuestionnaireResponseDto[] {
    return entities.map((entity) => this.toDto(entity));
  }

  /**
   * Преобразует сущность анкеты (без данных пользователя) в базовый DTO.
   */
  static toBaseDto(entity: Questionnaire): QuestionnaireBaseResponseDto {
    return {
      userId: entity.userId,
      sportsCategory: entity.sportsCategory,
      orderNumber: entity.orderNumber,
      assignmentDate:
        entity.assignmentDate instanceof Date
          ? entity.assignmentDate.toISOString().slice(0, 10)
          : null,
      assigningAuthority: entity.assigningAuthority,
      isFifaJudge: entity.isFifaJudge,
      fifaId: entity.fifaId,
      hasVarLicense: entity.hasVarLicense,
      heightCm: entity.heightCm,
      jogelEquipmentSize: entity.jogelEquipmentSize,
      jogelShoeSize: entity.jogelShoeSize,
      citizenship: entity.citizenship,
      countryOfResidence: entity.countryOfResidence,
      passportType: entity.passportType,
      passportSeries: entity.passportSeries,
      passportNumber: entity.passportNumber,
      issuedBy: entity.issuedBy,
      issueDate:
        entity.issueDate instanceof Date
          ? entity.issueDate.toISOString().slice(0, 10)
          : null,
      departmentCode: entity.departmentCode,
      phone: entity.phone,
    };
  }

  /**
   * Преобразует массив сущностей анкет в массив базовых DTO.
   */
  static toBaseDtoArray(
    entities: Questionnaire[],
  ): QuestionnaireBaseResponseDto[] {
    return entities.map((entity) => this.toBaseDto(entity));
  }
}
