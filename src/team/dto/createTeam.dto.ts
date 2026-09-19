import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength, IsUUID } from 'class-validator';
import { Constraint } from '../../common/decorators/unique.decorator.js';
import { vMsg } from '../../common/utils/validation-message.js';

export class CreateTeamDto {
  @ApiProperty({
    description: 'Название команды',
    example: 'Спартак',
  })
  @IsString({ message: vMsg('validation.IS_STRING') })
  @IsNotEmpty({ message: vMsg('validation.NOT_EMPTY') })
  @MaxLength(100, { message: vMsg('validation.MAX_LENGTH') })
  @Constraint({
    dbField: 'name',
    messages: { uniqueComposite: 'validation.UNIQUE_TEAM_CITY' },
  })
  name: string;

  @ApiProperty({
    description: 'ID города',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: vMsg('validation.IS_UUID') })
  @Constraint({
    dbField: 'cityId',
    messages: {
      foreignKey: 'validation.CITY_NOT_FOUND',
      uniqueComposite: 'validation.UNIQUE_TEAM_CITY',
    },
  })
  cityId: string;
}
