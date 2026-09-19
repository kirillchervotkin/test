import 'reflect-metadata';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Driver } from '@ydbjs/core';
import { query } from '@ydbjs/query';
import { ServiceAccountCredentialsProvider } from '@ydbjs/auth-yandex-cloud';
import { Type_PrimitiveTypeId as Types } from '@ydbjs/api/value';
import { ScheduleRepository } from '../dist/schedule/repository/schedule.repository.js';
const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const ddl = readFileSync('migrations/schedule/001-create-schedule.sql', 'utf8');
const names = [];
for (const match of ddl.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\);/g)) {
  const [_, name, body] = match;
  names.push(name);
  const actual = report.tables[name];
  assert(actual?.exists, name);
  assert.deepEqual(actual.primaryKey, ['id']);
  const expected = [
    ...body.matchAll(
      /`([^`]+)` (Uint64|Uint32|Int32|Utf8|Bool|Json|Date|Timestamp)( NOT NULL)?/g,
    ),
  ];
  assert.equal(actual.columns.length, expected.length);
  for (const [, column, kind, required] of expected) {
    const found = actual.columns.find((c) => c.name === column);
    assert(found, `${name}.${column}`);
    const type = found.type.type;
    assert.equal(
      type.case,
      required ? 'typeId' : 'optionalType',
      `${name}.${column} nullable`,
    );
    const value = required ? type.value : type.value.item.type.value;
    assert.equal(
      value,
      Types[kind === 'Utf8' ? 'UTF8' : kind.toUpperCase()],
      `${name}.${column} type`,
    );
  }
}
const driver = new Driver(
  `${process.env.YDB_ENDPOINT}${process.env.YDB_DATABASE}`,
  {
    credentialsProvider: new ServiceAccountCredentialsProvider(
      JSON.parse(
        readFileSync(
          process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS,
          'utf8',
        ),
      ),
    ),
  },
);
let sql;
try {
  await driver.ready(AbortSignal.timeout(15000));
  sql = query(driver);
  const repository = new ScheduleRepository(sql);
  await repository.read(async (db) => {
    for (const name of names) {
      await db.list(name);
      console.log(`VERIFIED ${name}: schema and repository SELECT`);
    }
  });
} finally {
  if (sql) await sql[Symbol.asyncDispose]();
  driver.close();
}
