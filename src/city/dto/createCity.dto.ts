// src/cities/dto/createCity.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateCityDto {
  @ApiProperty({
    description: 'Название города',
    example: 'Москва',
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Регион/область/край (необязательно)',
    example: 'Московская область',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  region?: string | null;
}
