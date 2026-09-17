import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Текущий пароль пользователя',
    example: 'OldPassword123',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Старый пароль не может быть пустым' })
  oldPassword: string;

  @ApiProperty({
    description: 'Новый пароль для установки',
    example: 'NewSecurePassword456',
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
  newPassword: string;
}
