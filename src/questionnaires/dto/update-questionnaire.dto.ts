// src/questionnaires/dto/update-questionnaire.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsDateString,
} from 'class-validator';

export class UpdateQuestionnaireDto {
  @ApiProperty({ description: 'UUID пользователя (обязательно)' })
  @IsUUID()
  userId: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  sportsCategory?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  orderNumber?: string;

  @ApiProperty({ required: false, format: 'date' })
  @IsDateString()
  @IsOptional()
  assignmentDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assigningAuthority?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isFifaJudge?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  fifaId?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  hasVarLicense?: boolean;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  heightCm?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  jogelEquipmentSize?: string;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  jogelShoeSize?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  citizenship?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  countryOfResidence?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  passportType?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  passportSeries?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  passportNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  issuedBy?: string;

  @ApiProperty({ required: false, format: 'date' })
  @IsDateString()
  @IsOptional()
  issueDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentCode?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;
}
