// src/report/dto/standards-report-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { RESULT_STATUSES } from '../../result/entities/types/result.types.js';
import type { ResultStatus } from '../../result/entities/types/result.types.js';
import { REPORT_STATUSES } from '../report.types.js';
import type { ReportStatus } from '../report.types.js';

/**
 * Одна попытка в отчёте.
 * В массиве слотов может стоять null — слот не заполнен
 * (например, спортсмен не использовал пересдачу).
 */
export class AttemptReportDto {
  @ApiProperty({
    description: 'Номер слота: 1..N+1 (N обязательных + слот пересдачи)',
    example: 1,
    minimum: 1,
  })
  legNumber: number;

  @ApiProperty({
    description:
      'Статус попытки: ' +
      '"completed" — зачтена, ' +
      '"not_credited" — выполнена, но не зачтена по вине спортсмена ' +
      '(фальстарт, заступ и т.п.), ' +
      '"not_admitted" — спортсмен не допущен к тесту.',
    enum: RESULT_STATUSES,
    example: 'completed',
  })
  status: ResultStatus;

  @ApiProperty({
    description:
      'Время в секундах. null — если метрика отсутствует ' +
      '(например, not_admitted).',
    example: 13.2,
    nullable: true,
  })
  time: number | null;

  @ApiProperty({
    description:
      'Уложилась ли попытка в failThresholdTime. ' +
      'null — если попытка не completed.',
    example: true,
    nullable: true,
  })
  passed: boolean | null;

  @ApiProperty({
    description:
      'Градация за эту попытку. Заполнена только для зачётных попыток.',
    example: 'B',
    nullable: true,
  })
  grade: string | null;

  @ApiProperty({
    description: 'Цвет градации (HEX).',
    example: '#4CAF50',
    nullable: true,
  })
  gradeColor: string | null;
}

/**
 * Строка отчёта по одному пользователю.
 */
export class StandardsReportResponseDto {
  @ApiProperty({
    example: 'Иванов',
    description: 'Фамилия пользователя',
  })
  lastName: string;

  @ApiProperty({
    example: 'Иван',
    description: 'Имя пользователя',
  })
  firstName: string;

  @ApiProperty({
    description:
      'N+1 слотов по основным забегам (isTen = false). ' +
      'null в массиве — слот не заполнен.',
    type: [AttemptReportDto],
    isArray: true,
    nullable: true,
    example: [
      {
        legNumber: 1,
        status: 'completed',
        time: 13.2,
        passed: true,
        grade: 'B',
        gradeColor: '#4CAF50',
      },
      {
        legNumber: 2,
        status: 'completed',
        time: 13.8,
        passed: true,
        grade: 'B',
        gradeColor: '#4CAF50',
      },
      null,
    ],
  })
  attempts: (AttemptReportDto | null)[];

  @ApiProperty({
    description:
      'N+1 слотов по 10m-забегам (isTen = true). ' +
      'Информативно, на итоговый статус и градацию не влияет.',
    type: [AttemptReportDto],
    isArray: true,
    nullable: true,
    example: [null, null, null],
  })
  attempts10m: (AttemptReportDto | null)[];

  @ApiProperty({
    description:
      'Среднее по зачётным основным попыткам. null — если зачётов нет.',
    example: 13.5,
    nullable: true,
  })
  averageTime: number | null;

  @ApiProperty({
    description: 'Итоговая градация по averageTime.',
    example: 'B',
    nullable: true,
  })
  grade: string | null;

  @ApiProperty({
    description: 'Цвет итоговой градации (HEX).',
    example: '#4CAF50',
    nullable: true,
  })
  gradeColor: string | null;

  @ApiProperty({
    description:
      'Итоговый статус по основным попыткам: ' +
      '"passed" — сдал, ' +
      '"failed" — попытки были, зачётов не хватило, ' +
      '"technical_error" — записей меньше N (данные неполные), ' +
      '"not_admitted" — не допущен, ' +
      '"not_attempted" — не сдавал (записей нет вообще).',
    enum: REPORT_STATUSES,
    example: 'passed',
  })
  status: ReportStatus;
}
