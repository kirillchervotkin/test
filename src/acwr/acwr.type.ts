export interface WorkloadData {
  date: string; // Дата в формате YYYY-MM-DD
  value: number; // Значение кардионагрузки
}

export interface EWMAValue {
  date: string; // Дата в формате YYYY-MM-DD
  value: number; // Значение EWMA
}

export interface ACWRResult {
  date: string; // Дата в формате YYYY-MM-DD
  acwr: number; // Отношение acute/chronic
}

export interface AcwrCalculator {
  /**
   * Расчет ACWR с использованием EWMA
   *
   * @param workloadData Массив данных о кардионагрузке
   * @param startDate Начальная дата периода расчета (включительно)
   * @param endDate Конечная дата периода расчета (включительно)
   * @param ewmaChronic Опциональный массив предрасчитанных значений EWMA 28
   * @param ewmaAcute Опциональный массив предрасчитанных значений EWMA 7
   * @returns Массив результатов ACWRResult для каждого дня в периоде
   */
  calculate(
    workloadData: WorkloadData[],
    startDate: string,
    endDate: string,
    ewmaChronic?: EWMAValue,
    ewmaAcute?: EWMAValue,
  ): ACWRResult[];
}
