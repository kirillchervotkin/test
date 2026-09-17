import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class CreateActivationUrlDto {
  @ApiProperty({
    description: 'ID пользователя для которого создается ссылка активации',
    example: 12345,
    required: true,
    type: Number,
  })
  @IsNumber({}, { message: 'userId должен быть числом' })
  @IsNotEmpty({ message: 'userId не может быть пустым' })
  userId: string;
}
