import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { QueryClient, SQL } from '@ydbjs/query';
import {
  Bool,
  Int32,
  Json,
  Text,
  Timestamp,
  Uint32,
  Uint64,
  Date as YdbDate,
} from '@ydbjs/value/primitive';
import { randomBytes } from 'node:crypto';
import { YDB_SQL } from '../../common/ydb/ydb.constants.js';
import { scheduleSchema } from '../entities/schedule.schema.js';
import type {
  Entity,
  Table,
  Tables,
} from '../entities/types/schedule.types.js';
import { ScheduleMapper } from '../mappers/schedule.mapper.js';

export interface ScheduleStore {
  get<K extends Table>(table: K, id: string): Promise<Tables[K]>;
  list<K extends Table>(
    table: K,
    where?: Partial<Tables[K]>,
  ): Promise<Tables[K][]>;
  save<K extends Table>(
    table: K,
    value: Tables[K],
    insert?: boolean,
  ): Promise<Tables[K]>;
  remove<K extends Table>(table: K, id: string): Promise<void>;
  stamp(): Promise<Entity>;
}

// Transactions live in the repository, as in test-grades. Business services
// receive a store bound to one serializable transaction, never a raw driver.
@Injectable()
export class ScheduleRepository {
  constructor(@Inject(YDB_SQL) private readonly sql: QueryClient) {}

  async transaction<T>(
    action: (store: ScheduleStore) => Promise<T>,
  ): Promise<T> {
    return this.sql.begin(
      { isolation: 'serializableReadWrite', idempotent: false },
      async (tx) => action(new YdbScheduleStore(this.sql, tx)),
    );
  }
  async read<T>(action: (store: ScheduleStore) => Promise<T>): Promise<T> {
    return this.sql.begin(
      { isolation: 'snapshotReadOnly', idempotent: true },
      async (tx) => action(new YdbScheduleStore(this.sql, tx)),
    );
  }
}

class YdbScheduleStore implements ScheduleStore {
  constructor(
    private readonly sql: QueryClient,
    private readonly tx: SQL,
  ) {}
  async stamp(): Promise<Entity> {
    const now = new Date().toISOString();
    return {
      id: (randomBytes(8).readBigUInt64BE() || 1n).toString(),
      createdAt: now,
      updatedAt: now,
    };
  }
  async get<K extends Table>(table: K, id: string): Promise<Tables[K]> {
    const rows = await this.list(table, { id } as Partial<Tables[K]>);
    if (!rows[0])
      throw new NotFoundException(`Объект ${table} с ID ${id} не найден`);
    return rows[0];
  }
  async list<K extends Table>(
    table: K,
    where: Partial<Tables[K]> = {},
  ): Promise<Tables[K][]> {
    const conditions = [];
    for (const [key, value] of Object.entries(where)) {
      const column = this.sql.identifier(key);
      if (!scheduleSchema[table][key]) throw new Error('Неизвестное поле');
      conditions.push(
        value == null
          ? this.sql.fragment`${column} IS NULL`
          : this.sql
              .fragment`${column} = ${await this.value(table, key, value)}`,
      );
    }
    const filter = conditions.length
      ? this.sql.fragment` WHERE ${this.sql.join(conditions, ' AND ')}`
      : this.sql.fragment``;
    const [rows] = await this
      .tx`SELECT * FROM ${this.sql.identifier(table)}${filter}`;
    return Promise.all(
      (rows ?? []).map((row) =>
        ScheduleMapper.fromRow(table, row as Record<string, unknown>),
      ),
    );
  }
  async save<K extends Table>(
    table: K,
    value: Tables[K],
    insert = false,
  ): Promise<Tables[K]> {
    const columns = Object.keys(scheduleSchema[table]);
    const values = [];
    for (const key of columns) {
      const item = (value as unknown as Record<string, unknown>)[key];
      values.push(
        item == null
          ? this.sql.fragment`NULL`
          : this.sql.fragment`${await this.value(table, key, item)}`,
      );
    }
    const names = columns.map(
      (key) => this.sql.fragment`${this.sql.identifier(key)}`,
    );
    const command = this.sql.unsafe(insert ? 'INSERT' : 'UPSERT');
    await this
      .tx`${command} INTO ${this.sql.identifier(table)} (${this.sql.join(names, ', ')}) VALUES (${this.sql.join(values, ', ')})`;
    return value;
  }
  async remove<K extends Table>(table: K, id: string): Promise<void> {
    await this
      .tx`DELETE FROM ${this.sql.identifier(table)} WHERE id = ${new Uint64(BigInt(id))}`;
  }
  private async value(table: Table, key: string, value: unknown) {
    const kind = scheduleSchema[table][key]?.replace('?', '');
    switch (kind) {
      case 'Uint64':
        return new Uint64(BigInt(await ScheduleMapper.id(value as string)));
      case 'Uint32':
        return new Uint32(Number(value));
      case 'Int32':
        return new Int32(Number(value));
      case 'Utf8':
        return new Text(String(value));
      case 'Bool':
        return new Bool(Boolean(value));
      case 'Json':
        return new Json(JSON.stringify(value));
      case 'Date':
        return new YdbDate(new Date(String(value)));
      case 'Timestamp':
        return new Timestamp(new Date(String(value)));
      default:
        throw new Error('Неизвестный тип поля');
    }
  }
}
