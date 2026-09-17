import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsDate } from 'class-validator';
import { Expose } from 'class-transformer';

export class AnthropometricDataResponseDto {
  @ApiProperty({ description: 'Уникальный идентификатор записи', example: 1 })
  @IsNumber()
  @Expose()
  id: number;

  @ApiProperty({
    description: 'Дата и время создания записи',
  })
  @IsDate()
  @Expose()
  date: Date;

  @ApiProperty({
    description: 'Место проведения измерений',
    example: 'Казань',
  })
  @IsString()
  @Expose()
  location: string;

  @ApiProperty({ description: 'Рост (см)', example: 180.5 })
  @IsNumber()
  @Expose()
  height: number;

  @ApiProperty({ description: 'Вес (кг)', example: 75.2 })
  @IsNumber()
  @Expose()
  weight: number;

  @ApiProperty({ description: 'Обхват бицепса (см)', example: 32.5 })
  @IsNumber()
  @Expose()
  biceps: number;

  @ApiProperty({ description: 'Обхват трицепса (см)', example: 28.1 })
  @IsNumber()
  @Expose()
  triceps: number;

  @ApiProperty({ description: 'Подлопаточная складка (мм)', example: 15.2 })
  @IsNumber()
  @Expose()
  subscapular: number;

  @ApiProperty({ description: 'Подвздошная складка (мм)', example: 18.7 })
  @IsNumber()
  @Expose()
  iliac: number;

  @ApiProperty({
    description: 'Пользователь, к которому относятся данные',
    example: 1,
  })
  @IsNumber()
  @Expose()
  userId: number;
}
