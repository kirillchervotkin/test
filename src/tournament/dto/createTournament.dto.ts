import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEnum, IsDate } from 'class-validator';

export enum TournamentStatus {
  PLANNED = 'planned',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export class CreateTournamentDto {
  @ApiProperty({
    description: 'Название турнира',
    example: 'Чемпионат мира 2023',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Описание турнира',
    example: 'Ежегодный чемпионат мира по футболу',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Дата начала турнира',
    example: '2023-06-01',
  })
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty({
    description: 'Дата окончания турнира',
    example: '2023-07-15',
  })
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiProperty({
    description: 'Статус турнира',
    enum: TournamentStatus,
    default: TournamentStatus.PLANNED,
  })
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;
}
