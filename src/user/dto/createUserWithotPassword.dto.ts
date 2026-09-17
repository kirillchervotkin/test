import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  Matches,
} from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';

export class CreateUserDto {
  @ApiProperty({
    description: 'Имя пользователя',
    example: 'Иван',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    description: 'Фамилия пользователя',
    example: 'Иванов',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

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
}
