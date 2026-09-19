import { readFileSync } from 'node:fs';
import { Driver } from '@ydbjs/core';
import { ServiceAccountCredentialsProvider } from '@ydbjs/auth-yandex-cloud';
import { fromBinary } from '@bufbuild/protobuf';
import {
  SchemeServiceDefinition,
  ListDirectoryResultSchema,
} from '@ydbjs/api/scheme';
import {
  TableServiceDefinition,
  CreateSessionResultSchema,
  DescribeTableResultSchema,
} from '@ydbjs/api/table';
const ddl = readFileSync('migrations/schedule/001-create-schedule.sql', 'utf8');
const statements = ddl
  .replace(/^--.*$/gm, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);
const names = statements.map((s) => s.match(/CREATE TABLE `([^`]+)`/)[1]);
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
function unpack(response, schema) {
  const op = response.operation;
  if (!op?.ready || op.status !== 400000)
    throw new Error(JSON.stringify({ status: op?.status, issues: op?.issues }));
  return schema ? fromBinary(schema, op.result.value) : null;
}
let sessionId;
const rpc = driver.createClient(TableServiceDefinition);
const options = () => ({ signal: AbortSignal.timeout(30000) });
try {
  await driver.ready(AbortSignal.timeout(15000));
  const scheme = driver.createClient(SchemeServiceDefinition);
  const listing = unpack(
    await scheme.listDirectory({ path: driver.database }, options()),
    ListDirectoryResultSchema,
  );
  sessionId = unpack(
    await rpc.createSession({}, options()),
    CreateSessionResultSchema,
  ).sessionId;
  const existing = new Set(listing.children.map((t) => t.name));
  const report = {
    mode: process.argv.includes('--apply') ? 'apply' : 'inspect',
    tables: {},
  };
  for (const name of names) {
    if (!existing.has(name)) {
      report.tables[name] = { exists: false };
      continue;
    }
    const info = unpack(
      await rpc.describeTable(
        { sessionId, path: `${driver.database}/${name}` },
        options(),
      ),
      DescribeTableResultSchema,
    );
    report.tables[name] = {
      exists: true,
      primaryKey: info.primaryKey,
      columns: info.columns,
    };
  }
  console.log(
    JSON.stringify(
      report,
      (_, v) => (typeof v === 'bigint' ? String(v) : v),
      2,
    ),
  );
  if (process.argv.includes('--apply')) {
    if (names.some((n) => existing.has(n)))
      throw new Error(
        'Existing tables require schema comparison before migration. No changes applied.',
      );
    for (let i = 0; i < names.length; i++) {
      unpack(
        await rpc.executeSchemeQuery(
          { sessionId, yqlText: statements[i] + ';' },
          options(),
        ),
      );
      const info = unpack(
        await rpc.describeTable(
          { sessionId, path: `${driver.database}/${names[i]}` },
          options(),
        ),
        DescribeTableResultSchema,
      );
      console.log(
        JSON.stringify({
          created: names[i],
          columns: info.columns.length,
          primaryKey: info.primaryKey,
        }),
      );
    }
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  if (sessionId)
    await rpc.deleteSession({ sessionId }, options()).catch(() => {});
  driver.close();
}
