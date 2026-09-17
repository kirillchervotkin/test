import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { readFileSync } from 'fs';
import { join } from 'path';
import { GetFitnessReportQueryDto } from './dto/getFitnessReportQuery.dto.js';
import { LatestUserAnthropometryResponseDto } from './dto/latestUserAnthropometryResponse.dto.js';
import { UserAnthropometryQueryDto } from './dto/userAnthropometryQuery.dto.js';
import { FitnessReportResponseDto } from './dto/fitnessReportResponse.dto.js';
import { ReportRepository } from './report.repository.js';
import { UserReportRow } from './report.types.js';

@Injectable()
export class ReportService {
  private sqlQueryAnthropometryReport: string;
  private sqlQueryFitnessReport: string;

  constructor(private readonly reportRepository: ReportRepository) {
    this.sqlQueryAnthropometryReport = this.loadSQL('anthropometryReport.sql');
    this.sqlQueryFitnessReport = this.loadSQL('fitnessReport.sql');
  }

  private loadSQL(fileName: string): string {
    try {
      const filePath = join(process.cwd(), 'src', 'sql', fileName);
      return readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to load SQL file ${fileName}: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to load SQL file ${fileName}: Unknown error occurred`,
      );
    }
  }

  getFitnessReport(
    dto: GetFitnessReportQueryDto,
  ): Promise<FitnessReportResponseDto[]> {
    void dto;
    // TODO: заменить заглушку на Drizzle-запрос к YDB.
    // Использовать this.sqlQueryFitnessReport и параметры dto:
    // startDate, endDate, userIds, listIds.
    const result: unknown[] = [];

    return Promise.resolve(
      plainToInstance(FitnessReportResponseDto, result, {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
      }),
    );
  }

  getUsersReport(
    getUsersReportDto: UserAnthropometryQueryDto,
  ): Promise<LatestUserAnthropometryResponseDto[]> {
    void getUsersReportDto;
    // TODO: заменить заглушку на Drizzle-запрос к YDB.
    // Использовать this.sqlQueryAnthropometryReport и параметры dto:
    // listIds, userIds.
    const result: unknown[] = [];
    const mapped = plainToInstance(LatestUserAnthropometryResponseDto, result, {
      excludeExtraneousValues: true,
      enableImplicitConversion: true,
    });

    return Promise.resolve(mapped);
  }

  async getStandardsReport(
    listId: string,
    testTypeId: string,
    trainingCampId?: string,
  ): Promise<UserReportRow[]> {
    return this.reportRepository.getUsersResultsByList(
      listId,
      testTypeId,
      trainingCampId,
    );
  }
}
