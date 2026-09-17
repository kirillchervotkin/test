import { ValidationArguments } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

export function vMsg(key: string): (args: ValidationArguments) => string {
  return (args: ValidationArguments) => i18nValidationMessage(key)(args);
}
