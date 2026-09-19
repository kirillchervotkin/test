import { ApiProperty } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto.js';
export class TemplateResponseDto extends CreateTemplateDto {
  @ApiProperty({ description: 'Идентификатор Uint64' })
  id!: string;
  @ApiProperty({ description: 'Дата создания' })
  createdAt!: string;
  @ApiProperty({ description: 'Дата изменения' })
  updatedAt!: string;
}
