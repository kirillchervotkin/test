import { Transform, Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class UserAnthropometryQueryDto {
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
}
