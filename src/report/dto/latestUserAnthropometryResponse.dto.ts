import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class LatestUserAnthropometryResponseDto {
  @ApiProperty({
    description: 'ID пользователя',
    example: 1,
  })
  @Expose()
  userId: number;

  @ApiProperty({
    description: 'Имя пользователя',
    example: 'Иван',
  })
  @Expose({ name: 'first_name' })
  firstName: string;

  @ApiProperty({
    description: 'Фамилия пользователя',
    example: 'Иванов',
  })
  @Expose({ name: 'last_name' })
  lastName: string;

  @ApiProperty({
    description: 'Дата рождения',
    example: '1990-01-01',
  })
  @Expose({ name: 'birth_date' })
  birthDate: Date;

  @ApiProperty({
    description: 'Дата замера антропометрии',
    example: '2023-10-01',
  })
  @Expose()
  date: Date;

  @ApiProperty({
    description: 'Место проведения замера',
    example: 'Спортивный зал №1',
  })
  @Expose()
  location: string;

  @ApiProperty({
    description: 'Текущий рост (см)',
    example: 185,
  })
  @Expose()
  height: number;

  @ApiProperty({
    description: 'Предыдущий рост',
    example: 184,
  })
  @Expose({ name: 'prev_height' })
  prevHeight: number;

  @ApiProperty({
    description: 'Текущий вес ',
    example: 80,
  })
  @Expose()
  weight: number;

  @ApiProperty({
    description: 'Предыдущий вес',
    example: 78,
  })
  @Expose({ name: 'prev_weight' })
  prevWeight: number;

  @ApiProperty({
    description: 'Текущее измерение бицепса',
    example: 32,
  })
  @Expose()
  biceps: number;

  @ApiProperty({
    description: 'Предыдущее измерение бицепса',
    example: 30,
  })
  @Expose({ name: 'prev_biceps' })
  prevBiceps: number;

  @ApiProperty({
    description: 'Текущее измерение трицепса',
    example: 25,
  })
  @Expose()
  triceps: number;

  @ApiProperty({
    description: 'Предыдущее измерение трицепса',
    example: 24,
  })
  @Expose({ name: 'prev_triceps' })
  prevTriceps: number;

  @ApiProperty({
    description: 'Текущее измерение под лопаткой',
    example: 15,
  })
  @Expose()
  subscapular: number;

  @ApiProperty({
    description: 'Предыдущее измерение под лопаткой',
    example: 16,
  })
  @Expose({ name: 'prev_subscapular' })
  prevSubscapular: number;

  @ApiProperty({
    description: 'Текущее измерение на подвздошной кости',
    example: 20,
  })
  @Expose()
  iliac: number;

  @ApiProperty({
    description: 'Предыдущее измерение на подвздошной кости',
    example: 21,
  })
  @Expose({ name: 'prev_iliac' })
  prevIliac: number;
}
