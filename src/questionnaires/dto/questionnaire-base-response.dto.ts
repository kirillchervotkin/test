// src/questionnaires/dto/questionnaire-base-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

export class QuestionnaireBaseResponseDto {
  @ApiProperty({ description: 'UUID пользователя' })
  userId: string;

  @ApiProperty({ required: false, nullable: true })
  sportsCategory: string | null;

  @ApiProperty({ required: false, nullable: true })
  orderNumber: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'date' })
  assignmentDate: string | null;

  @ApiProperty({ required: false, nullable: true })
  assigningAuthority: string | null;

  @ApiProperty({ required: false, nullable: true })
  isFifaJudge: boolean | null;

  @ApiProperty({ required: false, nullable: true })
  fifaId: string | null;

  @ApiProperty({ required: false, nullable: true })
  hasVarLicense: boolean | null;

  @ApiProperty({ required: false, nullable: true })
  heightCm: number | null;

  @ApiProperty({ required: false, nullable: true })
  jogelEquipmentSize: string | null;

  @ApiProperty({ required: false, nullable: true })
  jogelShoeSize: number | null;

  @ApiProperty({ required: false, nullable: true })
  citizenship: string | null;

  @ApiProperty({ required: false, nullable: true })
  countryOfResidence: string | null;

  @ApiProperty({ required: false, nullable: true })
  passportType: string | null;

  @ApiProperty({ required: false, nullable: true })
  passportSeries: string | null;

  @ApiProperty({ required: false, nullable: true })
  passportNumber: string | null;

  @ApiProperty({ required: false, nullable: true })
  issuedBy: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'date' })
  issueDate: string | null;

  @ApiProperty({ required: false, nullable: true })
  departmentCode: string | null;

  @ApiProperty({ required: false, nullable: true })
  phone: string | null;
}
