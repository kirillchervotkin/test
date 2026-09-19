import {
  BadRequestException,
  type ValidationPipeOptions,
} from '@nestjs/common';
export const scheduleValidationOptions: ValidationPipeOptions = {
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: (errors) =>
    new BadRequestException({
      message: 'Некорректные данные запроса',
      fields: errors.map((error) => error.property),
    }),
};
