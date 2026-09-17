import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform } from 'class-transformer';

export class FitnessReportResponseDto {
  @ApiProperty({
    description: 'Уникальный идентификатор пользователя',
    example: 12345,
  })
  @Expose({ name: 'user_id' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  userId: number;

  @ApiProperty({
    description: 'Имя пользователя',
    example: 'Иван',
  })
  @Expose({ name: 'first_name' })
  firstName: string;

  @ApiProperty({
    description: 'Фамилия пользователя',
    example: 'Петров',
  })
  @Expose({ name: 'last_name' })
  lastName: string;

  @ApiProperty({
    description: 'Общее время тренировки в секундах во всех зонах',
    example: 7200,
  })
  @Expose({ name: 'total_zone_seconds' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  totalZoneSeconds: number;

  @ApiProperty({
    description: 'Время в зоне 1 (легкая интенсивность) в секундах',
    example: 1200,
  })
  @Expose({ name: 'zone1_seconds' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  zone1Seconds: number;

  @ApiProperty({
    description: 'Время в зоне 2 (умеренная интенсивность) в секундах',
    example: 1800,
  })
  @Expose({ name: 'zone2_seconds' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  zone2Seconds: number;

  @ApiProperty({
    description: 'Время в зоне 3 (аэробная интенсивность) в секундах',
    example: 2400,
  })
  @Expose({ name: 'zone3_seconds' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  zone3Seconds: number;

  @ApiProperty({
    description: 'Время в зоне 4 (анаэробная интенсивность) в секундах',
    example: 1200,
  })
  @Expose({ name: 'zone4_seconds' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  zone4Seconds: number;

  @ApiProperty({
    description: 'Время в зоне 5 (максимальная интенсивность) в секундах',
    example: 600,
  })
  @Expose({ name: 'zone5_seconds' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  zone5Seconds: number;

  @ApiProperty({
    description: 'Количество тренировочных дней в периоде',
    example: 12,
  })
  @Expose({ name: 'training_days' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  trainingDays: number;

  @ApiProperty({
    description: 'Общая кардионагрузка',
    example: 4500,
  })
  @Expose({ name: 'total_cardio_load' })
  @Transform(({ value }: { value: string }) => parseInt(value, 10), {
    toClassOnly: true,
  })
  totalCardioLoad: number;
}
