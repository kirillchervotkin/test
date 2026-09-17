import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'Имя пользователя', example: 'Иван' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Фамилия пользователя',
    example: 'Иванов',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email пользователя (уникальный)',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsOptional()
  @Constraint({ dbField: 'email' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Дата рождения в формате YYYY-MM-DD',
    example: '1990-01-01',
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дата рождения должна быть в формате YYYY-MM-DD',
  })
  birthDate?: string;

  @ApiPropertyOptional({
    description: 'Активен ли пользователь',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
