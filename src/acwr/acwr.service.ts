import { Injectable, BadRequestException } from '@nestjs/common';
import {
  AcwrCalculator,
  ACWRResult,
  EWMAValue,
  WorkloadData,
} from './acwr.type.js';

@Injectable()
export class AcwrService implements AcwrCalculator {
  private readonly lambdaChronic: number = 2 / (28 + 1); // ≈ 0.06897
  private readonly lambdaAcute: number = 0.25; // = 2 / (7+1)

  calculate(
    workloadData: WorkloadData[],
    startDate: string,
    endDate: string,
    ewmaChronic?: EWMAValue,
    ewmaAcute?: EWMAValue,
  ): ACWRResult[] {
    // Валидация данных
    this.validateInput(startDate, endDate);

    // Если есть предрасчитанные ewma, то берем их дату в качестве первой для диапазона
    const startRangeDate = this.getStartRangeDate(startDate, ewmaChronic);

    // Создаем полный диапазон дат
    const fullDateRange = this.createDateRange(startRangeDate, endDate);

    // Подготовка данных (заполняем нулями пропущенные значения)
    const preparedData = this.prepareWorkloadData(workloadData, fullDateRange);

    // Рассчитываем или используем предоставленные значения EWMA
    const calculatedChronicEwma = this.calculateEWMA(
      preparedData,
      this.lambdaChronic,
      ewmaChronic,
    );
    const calculatedAcuteEwma = this.calculateEWMA(
      preparedData,
      this.lambdaAcute,
      ewmaAcute,
    );

    // Рассчитываем ACWR для каждого дня в запрошенном периоде
    return this.calculateACWRResults(
      calculatedChronicEwma,
      calculatedAcuteEwma,
      startDate,
      endDate,
    );
  }

  private validateInput(startDate: string, endDate: string): void {
    if (new Date(startDate) > new Date(endDate)) {
      throw new BadRequestException(
        'startDate must be less or equal to endDate',
      );
    }

    this.validateDateFormat(startDate);
    this.validateDateFormat(endDate);
  }

  private validateDateFormat(dateString: string): void {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      throw new BadRequestException(
        `Invalid date format: ${dateString}. Expected YYYY-MM-DD`,
      );
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${dateString}`);
    }
  }

  private getStartRangeDate(
    startDate: string,
    ewmaChronic?: EWMAValue,
  ): string {
    const minStartDate = this.subtractDays(startDate, 27);

    if (!ewmaChronic?.date) {
      return minStartDate;
    }

    const startTargetDate = new Date(startDate);
    const ewmaDate = new Date(ewmaChronic.date);
    const minDate = new Date(minStartDate);

    if (ewmaDate < minDate || ewmaDate > startTargetDate) {
      return minStartDate;
    }

    return ewmaChronic.date;
  }

  private createDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  private prepareWorkloadData(
    workloadData: WorkloadData[],
    dateRange: string[],
  ): WorkloadData[] {
    const dataMap = new Map<string, number>();

    workloadData.forEach((item) => {
      dataMap.set(item.date, item.value);
    });

    return dateRange
      .map((date) => ({
        date,
        value: dataMap.get(date) || 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // EWMA(t) = (currentLoad * lambda) + (previousEWMA * (1 - lambda))
  private calculateEWMA(
    workloadData: WorkloadData[],
    lambda: number,
    ewmaData?: EWMAValue,
  ): EWMAValue[] {
    const ewmaValues: EWMAValue[] = [];
    let previousEWMA = ewmaData
      ? ewmaData.value
      : workloadData[0].value * lambda;

    for (const data of workloadData.slice(1)) {
      const ewma = data.value * lambda + previousEWMA * (1 - lambda);
      ewmaValues.push({
        date: data.date,
        value: Math.round(ewma * 100) / 100,
      });
      previousEWMA = ewma;
    }

    return ewmaValues;
  }

  // ACWR: acute / chronic
  private calculateACWRResults(
    chronicData: EWMAValue[],
    acuteData: EWMAValue[],
    startDate: string,
    endDate: string,
  ): ACWRResult[] {
    const results: ACWRResult[] = [];
    const chronicMap = new Map(
      chronicData.map((item) => [item.date, item.value]),
    );
    const acuteMap = new Map(acuteData.map((item) => [item.date, item.value]));

    const currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];

      const acute = acuteMap.get(dateStr) || 0;
      const chronic = chronicMap.get(dateStr) || 0;
      const acwr =
        chronic === 0 ? 0 : Math.round((acute / chronic) * 100) / 100;

      results.push({
        date: dateStr,
        acwr,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return results;
  }

  private subtractDays(dateString: string, days: number): string {
    const date = new Date(dateString);
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }
}
