// src/test-types/dto/create-test-type.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsNumber,
  IsInt,
  IsOptional,
  Min,
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// ============================================================
// Кастомный валидатор: комбинация порогов должна быть ровно
// одной из трёх допустимых:
//   1. только failThresholdTime                          → time
//   2. только failThresholdSegments                      → segments
//   3. failThresholdLevel + failThresholdSegments        → level
// ============================================================
@ValidatorConstraint({ name: 'thresholdCombination', async: false })
class ThresholdCombinationConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as CreateTestTypeDto;

    const hasTime = o.failThresholdTime != null;
    const hasLevel = o.failThresholdLevel != null;
    const hasSegments = o.failThresholdSegments != null;

    // 1. Только time
    if (hasTime && !hasLevel && !hasSegments) return true;

    // 2. Только segments
    if (!hasTime && !hasLevel && hasSegments) return true;

    // 3. level + segments
    if (!hasTime && hasLevel && hasSegments) return true;

    return false;
  }

  defaultMessage(): string {
    return (
      'Provide exactly one of: failThresholdTime; ' +
      'failThresholdSegments; ' +
      'or both failThresholdLevel + failThresholdSegments'
    );
  }
}

export function IsValidThresholdCombination(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: ThresholdCombinationConstraint,
    });
  };
}

// ============================================================
// Кастомный валидатор для attemptsCount:
//   - для time-тестов поле обязательно и целое >= 1
//   - для остальных типов поле должно отсутствовать
// ============================================================
@ValidatorConstraint({ name: 'attemptsCountApplicable', async: false })
class AttemptsCountApplicableConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    const o = args.object as CreateTestTypeDto;
    const isTime = o.failThresholdTime != null;

    if (isTime) {
      return typeof value === 'number' && Number.isInteger(value) && value >= 1;
    }

    return value == null;
  }

  defaultMessage(args: ValidationArguments): string {
    const o = args.object as CreateTestTypeDto;
    const isTime = o.failThresholdTime != null;

    return isTime
      ? 'attemptsCount is required for time tests and must be an integer >= 1'
      : 'attemptsCount is only applicable to time tests ' +
          '(failThresholdTime must be set)';
  }
}

export function IsValidAttemptsCount(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: AttemptsCountApplicableConstraint,
    });
  };
}

// ============================================================
// DTO
//
// Поле `parameter` в DTO отсутствует намеренно: оно выводится из
// комбинации failThreshold* (см. resolveParameter в domain-типах)
// и проставляется в сервисном слое.
// ============================================================
export class CreateTestTypeDto {
  @ApiProperty({
    description: 'Уникальное название типа теста',
    example: 'Бег 100 м (муж)',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Пол, для которого предназначен тип теста',
    example: 'male',
    enum: ['male', 'female'],
  })
  @IsIn(['male', 'female'])
  gender: string;

  @ApiProperty({
    description: 'Порог несдачи для time-теста',
    example: 15.0,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsValidThresholdCombination()
  failThresholdTime?: number | null;

  @ApiProperty({
    description:
      'Порог несдачи по уровню. Должен идти вместе с failThresholdSegments.',
    example: 10.5,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsNumber() // уровень теперь вещественный
  @Min(0)
  failThresholdLevel?: number | null;

  @ApiProperty({
    description:
      'Порог несдачи по отрезкам. Используется один или вместе с failThresholdLevel.',
    example: 5,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  failThresholdSegments?: number | null;

  @ApiProperty({
    description:
      'Количество попыток. Обязательно и применимо только для time-тестов.',
    example: 2,
    required: false,
    nullable: true,
  })
  @IsValidAttemptsCount()
  attemptsCount?: number | null;
}
