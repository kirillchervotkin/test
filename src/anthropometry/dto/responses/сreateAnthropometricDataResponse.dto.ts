import { ApiProperty } from '@nestjs/swagger';

export class CreateAnthropometricDataResponseDto {
  @ApiProperty({ description: 'Уникальный идентификатор записи', example: 1 })
  id: number;

  @ApiProperty({
    description: 'Дата и время создания записи',
    example: '2024-01-01T10:00:00.000Z',
  })
  date: Date;

  @ApiProperty({ description: 'Место проведения измерений', example: 'Москва' })
  location: string;

  @ApiProperty({ description: 'Рост (см)', example: 185 })
  height: number;

  @ApiProperty({ description: 'Вес (кг)', example: 75 })
  weight: number;

  @ApiProperty({ description: 'Обхват бицепса (см)', example: 32.5 })
  biceps: number;

  @ApiProperty({ description: 'Обхват трицепса (см)', example: 28.1 })
  triceps: number;

  @ApiProperty({ description: 'Подлопаточная складка (мм)', example: 15.2 })
  subscapular: number;

  @ApiProperty({ description: 'Подвздошная складка (мм)', example: 18.7 })
  iliac: number;

  @ApiProperty({ description: 'Пользователь, к которому относятся данные' })
  userId: number;
}
