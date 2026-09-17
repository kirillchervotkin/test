// src/camp-participant/dto/update-bib.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateBibDto {
  @ApiProperty({
    example: 5,
    description: 'Новый номер манишки (bib) для пользователя в данном лагере',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  bib: number;
}
