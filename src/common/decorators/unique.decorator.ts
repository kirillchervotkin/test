import 'reflect-metadata';

export const CONSTRAINT_METADATA_KEY = Symbol('constraint');
export const CONSTRAINT_FIELDS_KEY = Symbol('constraint-fields');

export interface ConstraintMessages {
  unique?: string;
  uniqueComposite?: string;
  foreignKey?: string;
  notNull?: string;
  check?: string;
}

export interface ConstraintOptions {
  dbField?: string;
  messages?: ConstraintMessages;
}

export interface ConstraintMetadata {
  dbField?: string;
  messages: ConstraintMessages;
}

export function Constraint(options: ConstraintOptions = {}): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    const metadata: ConstraintMetadata = {
      dbField: options.dbField,
      messages: options.messages ?? {},
    };
    Reflect.defineMetadata(
      CONSTRAINT_METADATA_KEY,
      metadata,
      target,
      propertyKey,
    );

    // Получаем существующий массив полей, приведя тип к ожидаемому
    const existingFields: (string | symbol)[] = [
      ...((Reflect.getMetadata(CONSTRAINT_FIELDS_KEY, target) as
        | (string | symbol)[]
        | undefined) || []),
    ];

    if (!existingFields.includes(propertyKey)) {
      existingFields.push(propertyKey);
    }
    Reflect.defineMetadata(CONSTRAINT_FIELDS_KEY, existingFields, target);
  };
}
