// acwr.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WorkloadData, EWMAValue } from './acwr.type.js';
import { AcwrService } from './acwr.service.js';

// Тип для безопасного доступа к приватным методам
type AcwrServiceTestable = {
  calculateEWMA: (
    workloadData: WorkloadData[],
    alpha: number,
    precalculatedEwma?: EWMAValue,
  ) => EWMAValue[];
  getStartRangeDate: (endDate: string, ewmaChronic?: EWMAValue) => string;
  prepareWorkloadData: (
    workloadData: WorkloadData[],
    dateRange: string[],
  ) => WorkloadData[];
  calculateACWRResults: (
    chronicData: EWMAValue[],
    acuteData: EWMAValue[],
    startDate: string,
    endDate: string,
  ) => { date: string; acwr: number }[];
};

describe('AcwrService', () => {
  let service: AcwrService;
  let testable: AcwrServiceTestable;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AcwrService],
    }).compile();

    service = module.get<AcwrService>(AcwrService);
    testable = service as unknown as AcwrServiceTestable;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculate', () => {
    it('should calculate ACWR for basic case', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-01', value: 50 },
        { date: '2023-10-02', value: 60 },
        { date: '2023-10-03', value: 70 },
        { date: '2023-10-04', value: 80 },
        { date: '2023-10-05', value: 90 },
        { date: '2023-10-06', value: 100 },
        { date: '2023-10-07', value: 110 },
      ];

      const results = service.calculate(
        workloadData,
        '2023-10-07',
        '2023-10-07',
      );

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe('2023-10-07');
      expect(results[0].acwr).toBeGreaterThan(0);
    });

    it('should throw error for invalid date format', () => {
      const workloadData: WorkloadData[] = [{ date: '2023-10-01', value: 50 }];

      expect(() => {
        service.calculate(workloadData, 'invalid-date', '2023-10-01');
      }).toThrow(BadRequestException);
    });

    it('should throw error when startDate > endDate', () => {
      const workloadData: WorkloadData[] = [{ date: '2023-10-01', value: 50 }];

      expect(() => {
        service.calculate(workloadData, '2023-10-02', '2023-10-01');
      }).toThrow(BadRequestException);
    });
  });

  describe('EWMA calculation', () => {
    it('should calculate EWMA correctly without precalculated data', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-01', value: 50 },
        { date: '2023-10-02', value: 60 },
        { date: '2023-10-03', value: 70 },
      ];

      const ewmaResults = testable.calculateEWMA(workloadData, 0.25);

      expect(ewmaResults).toHaveLength(2);
      expect(ewmaResults[0].date).toBe('2023-10-02');
      expect(ewmaResults[1].date).toBe('2023-10-03');
    });

    it('should use precalculated EWMA value when provided', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-01', value: 50 },
        { date: '2023-10-02', value: 60 },
        { date: '2023-10-03', value: 70 },
      ];

      const precalculatedEwma: EWMAValue = {
        date: '2023-10-01',
        value: 55.55,
      };

      const ewmaResults = testable.calculateEWMA(
        workloadData,
        0.25,
        precalculatedEwma,
      );

      expect(ewmaResults).toHaveLength(2);
      expect(ewmaResults[0].date).toBe('2023-10-02');
      expect(ewmaResults[0].value).toBeCloseTo(56.66, 2);
    });
  });

  describe('getStartRangeDate', () => {
    it('should return minStartDate when no ewmaChronic provided', () => {
      const result = testable.getStartRangeDate('2023-10-28', undefined);
      expect(result).toBe('2023-10-01'); // 2023-10-28 - 27 days
    });

    it('should return ewmaChronic date when valid', () => {
      const ewmaChronic: EWMAValue = {
        date: '2023-10-15',
        value: 45.32,
      };

      const result = testable.getStartRangeDate('2023-10-28', ewmaChronic);
      expect(result).toBe('2023-10-15');
    });

    it('should return minStartDate when ewmaChronic date is too early', () => {
      const ewmaChronic: EWMAValue = {
        date: '2023-09-01',
        value: 45.32,
      };

      const result = testable.getStartRangeDate('2023-10-28', ewmaChronic);
      expect(result).toBe('2023-10-01');
    });
  });

  describe('prepareWorkloadData', () => {
    it('should fill missing dates with zeros', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-01', value: 50 },
        { date: '2023-10-03', value: 70 },
      ];

      const dateRange = ['2023-10-01', '2023-10-02', '2023-10-03'];
      const preparedData = testable.prepareWorkloadData(
        workloadData,
        dateRange,
      );

      expect(preparedData).toHaveLength(3);
      expect(preparedData[0].value).toBe(50);
      expect(preparedData[1].value).toBe(0);
      expect(preparedData[2].value).toBe(70);
    });

    it('should sort data chronologically', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-03', value: 70 },
        { date: '2023-10-01', value: 50 },
        { date: '2023-10-02', value: 60 },
      ];

      const dateRange = ['2023-10-01', '2023-10-02', '2023-10-03'];
      const preparedData = testable.prepareWorkloadData(
        workloadData,
        dateRange,
      );

      expect(preparedData[0].date).toBe('2023-10-01');
      expect(preparedData[1].date).toBe('2023-10-02');
      expect(preparedData[2].date).toBe('2023-10-03');
    });
  });

  describe('calculateACWRResults', () => {
    it('should calculate ACWR correctly', () => {
      const chronicData: EWMAValue[] = [
        { date: '2023-10-07', value: 45.32 },
        { date: '2023-10-08', value: 47.18 },
      ];

      const acuteData: EWMAValue[] = [
        { date: '2023-10-07', value: 85.71 },
        { date: '2023-10-08', value: 92.86 },
      ];

      const results = testable.calculateACWRResults(
        chronicData,
        acuteData,
        '2023-10-07',
        '2023-10-08',
      );

      expect(results).toHaveLength(2);
      expect(results[0].date).toBe('2023-10-07');
      expect(results[0].acwr).toBeCloseTo(85.71 / 45.32, 2);
      expect(results[1].date).toBe('2023-10-08');
      expect(results[1].acwr).toBeCloseTo(92.86 / 47.18, 2);
    });

    it('should handle zero chronic load', () => {
      const chronicData: EWMAValue[] = [{ date: '2023-10-07', value: 0 }];
      const acuteData: EWMAValue[] = [{ date: '2023-10-07', value: 85.71 }];

      const results = testable.calculateACWRResults(
        chronicData,
        acuteData,
        '2023-10-07',
        '2023-10-07',
      );

      expect(results[0].acwr).toBe(0);
    });

    it('should handle missing dates in results', () => {
      const chronicData: EWMAValue[] = [{ date: '2023-10-07', value: 45.32 }];
      const acuteData: EWMAValue[] = [{ date: '2023-10-08', value: 92.86 }];

      const results = testable.calculateACWRResults(
        chronicData,
        acuteData,
        '2023-10-07',
        '2023-10-08',
      );

      expect(results[0].acwr).toBe(0);
      expect(results[1].acwr).toBe(0);
    });
  });

  describe('Integration tests with precalculated EWMA', () => {
    it('should use precalculated chronic EWMA', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-15', value: 60 },
        { date: '2023-10-16', value: 70 },
      ];

      const ewmaChronic: EWMAValue = {
        date: '2023-10-15',
        value: 55.55,
      };

      const results = service.calculate(
        workloadData,
        '2023-10-16',
        '2023-10-16',
        ewmaChronic,
      );

      expect(results).toHaveLength(1);
      expect(results[0].date).toBe('2023-10-16');
    });

    it('should use precalculated acute EWMA', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-15', value: 60 },
        { date: '2023-10-16', value: 70 },
      ];

      const ewmaAcute: EWMAValue = {
        date: '2023-10-15',
        value: 65.55,
      };

      const results = service.calculate(
        workloadData,
        '2023-10-16',
        '2023-10-16',
        undefined,
        ewmaAcute,
      );

      expect(results).toHaveLength(1);
    });

    it('should use both precalculated EWMA values', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-15', value: 60 },
        { date: '2023-10-16', value: 70 },
      ];

      const ewmaChronic: EWMAValue = {
        date: '2023-10-15',
        value: 55.55,
      };
      const ewmaAcute: EWMAValue = {
        date: '2023-10-15',
        value: 65.55,
      };

      const results = service.calculate(
        workloadData,
        '2023-10-16',
        '2023-10-16',
        ewmaChronic,
        ewmaAcute,
      );

      expect(results).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle all zero values', () => {
      const workloadData: WorkloadData[] = [
        { date: '2023-10-01', value: 0 },
        { date: '2023-10-02', value: 0 },
        { date: '2023-10-03', value: 0 },
      ];

      const results = service.calculate(
        workloadData,
        '2023-10-03',
        '2023-10-03',
      );

      expect(results[0].acwr).toBe(0);
    });
  });
});
