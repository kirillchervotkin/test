// src/stages/dto/createStage.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsIn,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsObject,
  MaxLength,
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import type { StageType, StageFormat } from '../entities/types/stage.types.js';

// ============================================================
// Кастомный валидатор: согласованность `type` ↔ `format`.
//
// Инварианты:
//   - STAGE / PLAYOFF → format === null (контейнер, матчей нет)
//   - GROUP           → format === 'ROUND_ROBIN'
//   - ROUND           → format === 'ELIMINATION'
//
// Валидатор вешается на поле `format` и читает `type` из объекта
// через `args.object`. Это позволяет проверить согласованность
// без отдельного валидатора на `type`.
// ============================================================
@ValidatorConstraint({ name: 'stageFormatApplicability', async: false })
class StageFormatApplicabilityConstraint
  implements ValidatorConstraintInterface
{
  validate(value: unknown, args: ValidationArguments): boolean {
    const o = args.object as CreateStageDto;
    const isContainer = o.type === 'STAGE' || o.type === 'PLAYOFF';

    if (isContainer) {
      return value == null;
    }

    if (o.type === 'GROUP') return value === 'ROUND_ROBIN';
    if (o.type === 'ROUND') return value === 'ELIMINATION';

    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const o = args.object as CreateStageDto;
    const isContainer = o.type === 'STAGE' || o.type === 'PLAYOFF';

    if (isContainer) {
      return `format must be null for type=${o.type} (container stage)`;
    }
    if (o.type === 'GROUP') {
      return `format must be "ROUND_ROBIN" for type=GROUP`;
    }
    if (o.type === 'ROUND') {
      return `format must be "ELIMINATION" for type=ROUND`;
    }
    return 'invalid format for the given type';
  }
}

export function IsValidStageFormat(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: StageFormatApplicabilityConstraint,
    });
  };
}

// ============================================================
// DTO
//
// `tournamentId` клиент не передаёт — он берётся из path-параметра
// маршрута (`POST /tournaments/:tournamentId/stages`) и подставляется
// в маппере отдельным аргументом.
// ============================================================
export class CreateStageDto {
  @ApiProperty({
    description: 'Название этапа',
    example: 'Группа A',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description:
      'Тип этапа: STAGE/PLAYOFF — контейнеры (без матчей напрямую), ' +
      'GROUP — группа, ROUND — раунд плей-офф',
    example: 'GROUP',
    enum: ['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'],
  })
  @IsIn(['STAGE', 'GROUP', 'ROUND', 'PLAYOFF'])
  type: StageType;

  @ApiProperty({
    description:
      'Формат игры. Обязателен для GROUP (ROUND_ROBIN) и ROUND (ELIMINATION). ' +
      'Должен отсутствовать для контейнеров STAGE/PLAYOFF.',
    example: 'ROUND_ROBIN',
    enum: ['ROUND_ROBIN', 'ELIMINATION'],
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsIn(['ROUND_ROBIN', 'ELIMINATION'])
  @IsValidStageFormat()
  format?: StageFormat | null;

  @ApiProperty({
    description: 'ID родительского этапа (для дочерних этапов)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  parentStageId?: string | null;

  @ApiProperty({
    description: 'Порядок среди соседних этапов',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({
    description: 'Гибкие параметры этапа (очки, тай-брейки, правила обмена)',
    example: { rounds: 2, pointsForWin: 3, pointsForDraw: 1 },
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown> | null;
}
