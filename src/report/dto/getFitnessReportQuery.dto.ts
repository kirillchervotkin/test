import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsOptional, IsArray, IsNumber } from 'class-validator';

export class GetFitnessReportQueryDto {
  @ApiProperty({
    description:
      'Начальная дата периода для формирования фитнес-отчета (в формате ISO string)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiProperty({
    description:
      'Конечная дата периода для формирования фитнес-отчета (в формате ISO string)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
    type: String,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @ApiProperty({
    description: 'Массив ID пользователей для включения в фитнес-отчет',
    example: [123, 456],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    const arrayValue = Array.isArray(value) ? value : [value];

    return arrayValue.map((v) => Number(v));
  })
  userIds?: number[];

  @ApiProperty({
    description: 'Массив ID списков пользователей для фильтрации фитнес-отчета',
    example: [1, 2, 3],
    type: [Number],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  @Transform(({ value }) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    const arrayValue = Array.isArray(value) ? value : [value];

    return arrayValue.map((v) => Number(v));
  })
  listIds?: number[];
}
