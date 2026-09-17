import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @ApiProperty({
    description: 'Электронная почта пользователя',
    example: 'user@example.com',
    required: true,
  })
  @IsEmail({}, { message: 'Некорректный email' })
  @IsNotEmpty({ message: 'Имя пользователя не может быть пустым' })
  email: string;

  @ApiProperty({
    description: 'Пароль учетной записи',
    example: 'yourPassword123!',
    required: true,
    minLength: 8,
  })
  @IsString({ message: 'Пароль должен быть строкой' })
  @IsNotEmpty({ message: 'Пароль не может быть пустым' })
  password: string;
}
