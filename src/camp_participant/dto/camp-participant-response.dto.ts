// src/camp-participant/dto/camp-participant-response.dto.ts

import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO для ответа по эндпоинту /camps/:campId/users.
 * Содержит данные пользователя и его номер (bib) в конкретном лагере.
 */
export class CampUserDto {
  @ApiProperty({ example: 'uuid', description: 'UUID пользователя' })
  id: string;

  @ApiProperty({ example: 'Иван', description: 'Имя пользователя' })
  firstName: string;

  @ApiProperty({ example: 'Иванов', description: 'Фамилия пользователя' })
  lastName: string;

  @ApiProperty({
    example: 'ivan@example.com',
    description: 'Email пользователя',
  })
  email: string;

  @ApiProperty({
    example: 5,
    description: 'Номер манишки (bib) в данном лагере',
  })
  bib: number;
}

/**
 * DTO для ответа по эндпоинту /users/:userId/participations.
 * Содержит информацию об участии пользователя в лагере: идентификатор лагеря и номер bib.
 */
export class CampParticipationDto {
  @ApiProperty({ example: 'uuid', description: 'UUID лагеря' })
  campId: string;

  @ApiProperty({ example: 5, description: 'Номер манишки (bib) в этом лагере' })
  bib: number;
}
