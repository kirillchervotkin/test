// src/report/report.mapper.ts

import { StandardsReportResponseDto } from './dto/standards-report-response.dto.js';
import { UserReportRow } from './report.types.js';

export class ReportMapper {
  static toStandardsDtoList(
    rows: UserReportRow[],
  ): StandardsReportResponseDto[] {
    return rows.map((row) => this.toStandardsDto(row));
  }

  static toStandardsDto(row: UserReportRow): StandardsReportResponseDto {
    return {
      lastName: row.lastName,
      firstName: row.firstName,
      attempts: row.attempts,
      attempts10m: row.attempts10m,
      averageTime: row.averageTime,
      grade: row.grade,
      gradeColor: row.gradeColor,
      status: row.status,
    };
  }
}
