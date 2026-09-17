import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty({
    description: 'Электронная почта пользователя',
    example: 'user@example.com',
    required: true,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Пароль учетной записи',
    example: 'SecurePassword123',
    required: true,
    minLength: 8,
    maxLength: 50,
    pattern: '/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/, {
    message:
      'Пароль должен содержать как минимум одну строчную букву, одну заглавную букву и одну цифру',
  })
  password: string;

  @ApiProperty({
    description: 'Дата рождения пользователя в формате ГГГГ-ММ-ДД',
    example: '1990-01-15',
    required: true,
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Дата рождения должна быть в формате YYYY-MM-DD',
  })
  birthDate: string;

  @ApiProperty({
    description: 'Код активации для подтверждения регистрации',
    example: '123456',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  activationCode: string;
}
