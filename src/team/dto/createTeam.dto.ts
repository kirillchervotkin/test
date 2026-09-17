import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsInt, Min } from 'class-validator';
import { vMsg } from '../../common/utils/validation-message.js';

export class CreateTeamDto {
  @ApiProperty({
    description: 'Название команды',
    example: 'Спартак',
  })
  @IsString({ message: vMsg('validation.IS_STRING') })
  @IsNotEmpty({ message: vMsg('validation.NOT_EMPTY') })
  @MaxLength(100, { message: vMsg('validation.MAX_LENGTH') })
  name: string;

  @ApiProperty({
    description: 'ID города',
    example: 1,
  })
  @IsInt({ message: vMsg('validation.IS_INT') })
  @Min(1, { message: vMsg('validation.MIN') })
  cityId: number;
}
