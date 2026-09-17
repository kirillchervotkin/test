import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAnthropometryQueryDto {
  @ApiPropertyOptional({
    description: 'Начальная дата для фильтрации (включительно)',
    type: Date,
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  from?: Date;

  @ApiPropertyOptional({
    description: 'Конечная дата для фильтрации (включительно)',
    type: Date,
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  to?: Date;
}
