import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, IsNotEmpty } from 'class-validator';

export class CreateAnthropometricDataDto {
  @ApiProperty({
    description: 'Место проведения измерений',
    example: 'Москва',
  })
  @IsString({ message: 'Место проведения должно быть строкой' })
  @IsNotEmpty({ message: 'Место проведения не может быть пустым' })
  readonly location: string;

  @ApiProperty({
    description: 'Рост в сантиметрах',
    example: 185,
    minimum: 0,
  })
  @IsNumber({ allowNaN: false }, { message: 'Рост должен быть числом' })
  @Min(0, { message: 'Рост не может быть отрицательным' })
  readonly height: number;

  @ApiProperty({
    description: 'Вес в килограммах',
    example: 75,
    minimum: 0,
  })
  @IsNumber({ allowNaN: false }, { message: 'Вес должен быть числом' })
  @Min(0, { message: 'Вес не может быть отрицательным' })
  readonly weight: number;

  @ApiProperty({
    description: 'Измерение бицепса в сантиметрах',
    example: 32.5,
    minimum: 0,
  })
  @IsNumber(
    { allowNaN: false },
    { message: 'Обхват бицепса должен быть числом' },
  )
  @Min(0, { message: 'Обхват бицепса не может быть отрицательным' })
  readonly biceps: number;

  @ApiProperty({
    description: 'Измерение трицепса в сантиметрах',
    example: 28.1,
    minimum: 0,
  })
  @IsNumber(
    { allowNaN: false },
    { message: 'Обхват трицепса должен быть числом' },
  )
  @Min(0, { message: 'Обхват трицепса не может быть отрицательным' })
  readonly triceps: number;

  @ApiProperty({
    description: 'Подлопаточная складка в миллиметрах',
    example: 15.2,
    minimum: 0,
  })
  @IsNumber(
    { allowNaN: false },
    { message: 'Подлопаточная складка должна быть числом' },
  )
  @Min(0, { message: 'Подлопаточная складка не может быть отрицательной' })
  readonly subscapular: number;

  @ApiProperty({
    description: 'Подвздошная складка в миллиметрах',
    example: 18.7,
    minimum: 0,
  })
  @IsNumber(
    { allowNaN: false },
    { message: 'Подвздошная складка должна быть числом' },
  )
  @Min(0, { message: 'Подвздошная складка не может быть отрицательной' })
  readonly iliac: number;
}
