import { BadRequestException } from '@nestjs/common';
import { scheduleSchema } from '../entities/schedule.schema.js';
import type { Table, Tables } from '../entities/types/schedule.types.js';

export class ScheduleMapper {
  static async id(value: string | number): Promise<string> {
    const text = String(value);
    if (
      !/^[1-9]\d{0,19}$/.test(text) ||
      BigInt(text) > 18446744073709551615n ||
      (typeof value === 'number' && !Number.isSafeInteger(value))
    ) {
      throw new BadRequestException(
        'Идентификатор должен быть строкой положительного Uint64',
      );
    }
    return text;
  }

  static async fromRow<K extends Table>(
    table: K,
    row: Record<string, unknown>,
  ): Promise<Tables[K]> {
    const mapped: Record<string, unknown> = {};
    for (const [key, kind] of Object.entries(scheduleSchema[table])) {
      const value = row[key];
      if (value === null || value === undefined) {
        mapped[key] = null;
        continue;
      }
      if (kind.startsWith('Uint64')) mapped[key] = String(value);
      else if (kind === 'Date')
        mapped[key] = new Date(value as string | number | Date)
          .toISOString()
          .slice(0, 10);
      else if (kind === 'Timestamp')
        mapped[key] = new Date(value as string | number | Date).toISOString();
      else if (kind.startsWith('Json'))
        mapped[key] =
          typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
      else if (kind.startsWith('Uint32') || kind.startsWith('Int32'))
        mapped[key] = Number(value);
      else mapped[key] = value;
    }
    return mapped as unknown as Tables[K];
  }
}
