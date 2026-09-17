import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  ValidationOptions,
  registerDecorator,
} from 'class-validator';

interface ResultItemShape {
  status?: string;
  time?: number | null;
  level?: number | null;
  segments?: number | null;
}

@ValidatorConstraint({ name: 'isResultStatusConsistent', async: false })
export class IsResultStatusConsistentConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as ResultItemShape;
    const status = obj.status ?? 'completed';

    const hasAnyMetric =
      obj.time != null || obj.level != null || obj.segments != null;

    if (status === 'completed' && !hasAnyMetric) return false;
    if (status === 'not_admitted' && hasAnyMetric) return false;
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    const obj = args.object as ResultItemShape;
    const status = obj.status ?? 'completed';

    if (status === 'completed') {
      return 'completed result must have at least one metric (time | level | segments)';
    }
    if (status === 'not_admitted') {
      return 'not_admitted result must not have metrics (time | level | segments)';
    }
    return 'invalid combination of status and metrics';
  }
}

/**
 * Кросс-полевая проверка для одного забега:
 *   - status = 'completed'    → хотя бы одна из метрик time/level/segments заполнена;
 *   - status = 'not_admitted' → все метрики пустые;
 *   - status = 'not_credited' → без ограничений.
 *
 * Навешивается на поле `status`. Внутри читает соседние поля через args.object.
 */
export function IsResultStatusConsistent(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      validator: IsResultStatusConsistentConstraint,
    });
  };
}
