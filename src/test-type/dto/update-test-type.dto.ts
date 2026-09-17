// src/test-types/dto/update-test-type.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsInt,
  Min,
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// ============================================================
// Кастомный валидатор для частичного обновления:
//   - если ни один из порогов не передан — проверка пропускается
//     (частичное обновление name / gender);
//   - если передан хотя бы один — комбинация должна быть ровно
//     одной из трёх допустимых:
//       1. только failThresholdTime
//       2. только failThresholdSegments
//       3. failThresholdLevel + failThresholdSegments
//
// Клиент, обновляющий пороги, должен передавать полный набор
// для выбранного типа теста (например, level + segments вместе).
// ============================================================
@ValidatorConstraint({ name: 'thresholdCombinationUpdate', async: false })
class ThresholdCombinationUpdateConstraint
  implements ValidatorConstraintInterface
{
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as UpdateTestTypeDto;

    const hasTime = o.failThresholdTime != null;
    const hasLevel = o.failThresholdLevel != null;
    const hasSegments = o.failThresholdSegments != null;

    // Пороги не переданы — обновляем только name / gender и т.п.
    if (!hasTime && !hasLevel && !hasSegments) return true;

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

export function IsValidThresholdCombinationUpdate(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: ThresholdCombinationUpdateConstraint,
    });
  };
}

// ============================================================
// Валидатор attemptsCount при частичном обновлении.
//
// В PATCH-семантике DTO не знает текущего состояния сущности в БД,
// поэтому здесь проверяется только форма значения:
//   - если поле передано — целое >= 1;
//   - если не передано — пропускаем (не трогаем в БД).
//
// Применимость поля к time-тестам (т.е. что текущий/новый тест
// действительно time-тест) проверяется в сервисном слое после
// слияния патча с текущей сущностью.
// ============================================================
@ValidatorConstraint({ name: 'attemptsCountFormat', async: false })
class AttemptsCountFormatConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null) return true; // не передано — ок
    return typeof value === 'number' && Number.isInteger(value) && value >= 1;
  }

  defaultMessage(): string {
    return 'attemptsCount must be an integer >= 1';
  }
}

export function IsValidAttemptsCountUpdate(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: AttemptsCountFormatConstraint,
    });
  };
}

// ============================================================
// DTO
//
// `id` здесь намеренно отсутствует: он берётся из path-параметра
// маршрута (`PATCH /test-types/:id`) и передаётся в маппер
// отдельным аргументом (`TestTypeMapper.toUpdateData(id, dto)`).
// ============================================================
export class UpdateTestTypeDto {
  @ApiProperty({
    description: 'Новое название типа теста (необязательно)',
    required: false,
    example: 'Бег 100 м (муж)',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    description: 'Новый пол типа теста (необязательно)',
    required: false,
    example: 'male',
    enum: ['male', 'female'],
  })
  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: string;

  @ApiProperty({
    description: 'Новый порог несдачи для time-теста (необязательно)',
    required: false,
    nullable: true,
    example: 15.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @IsValidThresholdCombinationUpdate()
  failThresholdTime?: number | null;

  @ApiProperty({
    description:
      'Новый порог несдачи по уровню (вещественный). ' +
      'Должен идти вместе с failThresholdSegments (необязательно).',
    required: false,
    nullable: true,
    example: 10.5,
  })
  @IsOptional()
  @IsNumber() // уровень теперь вещественный
  @Min(0)
  failThresholdLevel?: number | null;

  @ApiProperty({
    description:
      'Новый порог несдачи по отрезкам (необязательно). ' +
      'Используется один или вместе с failThresholdLevel.',
    required: false,
    nullable: true,
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  failThresholdSegments?: number | null;

  @ApiProperty({
    description:
      'Новое количество попыток. Применимо только для time-тестов ' +
      '(необязательно). Чтобы снять значение, передайте null.',
    required: false,
    nullable: true,
    example: 2,
  })
  @IsOptional()
  @IsValidAttemptsCountUpdate()
  attemptsCount?: number | null;
}
