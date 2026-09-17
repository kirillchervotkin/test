import { mappingStorage } from '../middlwares/context.js';
import {
  CONSTRAINT_FIELDS_KEY,
  CONSTRAINT_METADATA_KEY,
  ConstraintMessages,
  ConstraintMetadata,
} from '../decorators/unique.decorator.js';
import {
  ArgumentMetadata,
  Injectable,
  Type,
  ValidationPipe,
  type ValidationPipeOptions,
} from '@nestjs/common';

@Injectable()
export class StoreDtoValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super(options);
  }

  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    const dtoClass = metadata.metatype;
    if (dtoClass) {
      const store = mappingStorage.getStore();
      if (store) {
        const mappings = this.buildMappingsForDto(dtoClass);
        // Сливаем, а не заменяем, чтобы сохранить метаданные параметров
        // (например, из @ConstraintParam), которые могут быть добавлены ранее
        store.columnMapping = {
          ...store.columnMapping,
          ...mappings.columnMapping,
        };
        store.validationMessages = {
          ...store.validationMessages,
          ...mappings.validationMessages,
        };
      }
    }
    return super.transform(value, metadata);
  }

  private buildMappingsForDto(dtoClass: Type): {
    columnMapping: Record<string, string>;
    validationMessages: Record<string, ConstraintMessages>;
  } {
    const columnMapping: Record<string, string> = {};
    const validationMessages: Record<string, ConstraintMessages> = {};
    const prototype = dtoClass.prototype as Type;

    const fields: string[] =
      (Reflect.getMetadata(CONSTRAINT_FIELDS_KEY, prototype) as
        | string[]
        | undefined) || [];

    for (const key of fields) {
      const metadata = Reflect.getMetadata(
        CONSTRAINT_METADATA_KEY,
        prototype,
        key,
      ) as ConstraintMetadata | undefined;

      if (metadata) {
        validationMessages[key] = metadata.messages ?? {};
        if (metadata.dbField) {
          columnMapping[metadata.dbField] = key;
        }
      }
    }

    return { columnMapping, validationMessages };
  }
}
