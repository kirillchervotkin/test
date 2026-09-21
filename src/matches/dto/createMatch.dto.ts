// src/matches/dto/createMatch.dto.ts

import { ApiProperty, OmitType } from '@nestjs/swagger';
import {
  IsUUID,
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  registerDecorator,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// ============================================================
// Кастомный валидатор: если обе команды переданы, они не должны
// совпадать.
//
// Вешается на homeTeamId, читает awayTeamId через args.object.
// Если хотя бы одна команда не задана (null/undefined) — проверка
// пропускается: для матчей плей-офф команды могут быть ещё не
// определены.
// ============================================================
@ValidatorConstraint({ name: 'differentTeams', async: false })
class DifferentTeamsConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as CreateMatchDto;
    if (!o.homeTeamId || !o.awayTeamId) return true;
    return o.homeTeamId !== o.awayTeamId;
  }

  defaultMessage(): string {
    return 'homeTeamId and awayTeamId must be different';
  }
}

export function IsDifferentTeams(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: DifferentTeamsConstraint,
    });
  };
}

// ============================================================
// DTO
//
// `tournamentId` НЕ передаётся клиентом — он выводится из `stageId`
// в сервисном слое (через stage.tournamentId). Это гарантирует
// согласованность: матч всегда принадлежит турниру своего этапа.
//
// Согласованность `tourNumber` ↔ `stage.format` (ROUND_ROBIN vs
// ELIMINATION) проверяется в сервисе: DTO не видит этапа.
// ============================================================
export class CreateMatchDto {
  @ApiProperty({
    description: 'ID этапа, к которому относится матч',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  stageId: string;

  @ApiProperty({
    description: 'Дата и время матча (ISO 8601)',
    example: '2023-09-15T20:00:00.000Z',
  })
  @IsDateString()
  matchDate: string;

  @ApiProperty({
    description: 'ID города, где проходит матч',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  cityId: string;

  @ApiProperty({
    description:
      'Номер тура. Заполняется только для матчей кругового этапа ' +
      '(ROUND_ROBIN). Для плей-офф (ELIMINATION) должен отсутствовать.',
    example: 5,
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  tourNumber?: number | null;

  @ApiProperty({
    description:
      'ID домашней команды. Может отсутствовать для матчей плей-офф, ' +
      'участники которых определяются по результатам групп.',
    example: '550e8400-e29b-41d4-a716-446655440002',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  @IsDifferentTeams()
  homeTeamId?: string | null;

  @ApiProperty({
    description: 'ID гостевой команды',
    example: '550e8400-e29b-41d4-a716-446655440003',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  awayTeamId?: string | null;
}

/** Вложенный маршрут получает stageId из URL до вызова сервиса. */
export class CreateMatchInStageDto extends OmitType(CreateMatchDto, ['stageId'] as const) {}
