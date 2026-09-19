// Only empty databases are migrated automatically. Stop API writers before --apply.
// Originals are retained as *_before_uuid_v2; no DROP or row deletion is performed.
import { readFileSync } from 'node:fs';
import { Driver } from '@ydbjs/core';
import { query } from '@ydbjs/query';
import { ServiceAccountCredentialsProvider } from '@ydbjs/auth-yandex-cloud';
import { fromBinary } from '@bufbuild/protobuf';
import {
  TableServiceDefinition,
  CreateSessionResultSchema,
  DescribeTableResultSchema,
} from '@ydbjs/api/table';
const driver = new Driver(process.env.YDB_ENDPOINT + process.env.YDB_DATABASE, {
  credentialsProvider: new ServiceAccountCredentialsProvider(
    JSON.parse(
      readFileSync(
        process.env.YDB_SERVICE_ACCOUNT_KEY_FILE_CREDENTIALS,
        'utf8',
      ),
    ),
  ),
});
const sql = query(driver),
  rpc = driver.createClient(TableServiceDefinition);
const options = () => ({ signal: AbortSignal.timeout(30000) });
function unpack(r, schema) {
  if (!r.operation?.ready || r.operation.status !== 400000)
    throw new Error(JSON.stringify(r.operation?.issues));
  return schema ? fromBinary(schema, r.operation.result.value) : undefined;
}
let sessionId;
const statements = readFileSync(
  'migrations/references/002-uuid-tables.sql',
  'utf8',
)
  .replace(/^--.*$/gm, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);
const names = statements.map((s) => s.match(/CREATE TABLE `([^`]+)`/)[1]);
const refs = {
  cities: ['id'],
  teams: ['id', 'cityId'],
  matches: ['cityId', 'homeTeamId', 'awayTeamId'],
  tournament_team_slots: ['teamId'],
  bracket_slots: ['resolvedTeamId'],
};
const typeId = (column) =>
  column.type.type.case === 'optionalType'
    ? column.type.type.value.item.type.value
    : column.type.type.value;
async function describe(name) {
  return unpack(
    await rpc.describeTable(
      { sessionId, path: `${driver.database}/${name}` },
      options(),
    ),
    DescribeTableResultSchema,
  );
}
async function assertEmpty() {
  for (const name of [...names, 'stages', 'tournament_templates']) {
    const [rows] =
      await sql`SELECT COUNT(*) AS count FROM ${sql.identifier(name)}`;
    if (BigInt(rows[0].count) !== 0n)
      throw new Error(
        `${name} contains data: automatic migration refused. Export and map existing IDs first.`,
      );
  }
}
try {
  await driver.ready(AbortSignal.timeout(15000));
  sessionId = unpack(
    await rpc.createSession({}, options()),
    CreateSessionResultSchema,
  ).sessionId;
  const states = [];
  for (const name of names) {
    const info = await describe(name);
    const types = Object.fromEntries(
      info.columns
        .filter((c) => refs[name].includes(c.name))
        .map((c) => [c.name, typeId(c)]),
    );
    // YDB Type.PrimitiveTypeId UUID=4611, UINT64=4.
    const ready = refs[name].every((k) => types[k] === 4611);
    if (!ready && !refs[name].every((k) => types[k] === 4))
      throw new Error(
        `Unexpected mixed schema in ${name}: ${JSON.stringify(types)}`,
      );
    states.push(ready);
    console.log(JSON.stringify({ table: name, types, ready }));
  }
  if (states.every(Boolean)) console.log('UUID migration already applied.');
  else {
    if (states.some(Boolean))
      throw new Error('Mixed migration state: inspect before proceeding.');
    await assertEmpty();
    console.log('All affected tables and JSON references are empty.');
    if (process.argv.includes('--apply')) {
      if (!process.argv.includes('--writers-stopped'))
        throw new Error('Stop all API writers and pass --writers-stopped.');
      for (let i = 0; i < names.length; i++) {
        const ddl = statements[i].replace(
          `CREATE TABLE \`${names[i]}\``,
          `CREATE TABLE \`${names[i]}_uuid_v2_new\``,
        );
        unpack(
          await rpc.executeSchemeQuery(
            { sessionId, yqlText: ddl + ';' },
            options(),
          ),
        );
        const created = await describe(names[i] + '_uuid_v2_new');
        if (
          !refs[names[i]].every(
            (k) => typeId(created.columns.find((c) => c.name === k)) === 4611,
          )
        )
          throw new Error('Staging schema verification failed.');
      }
      await assertEmpty();
      const path = (n) => `${driver.database}/${n}`;
      unpack(
        await rpc.renameTables(
          {
            sessionId,
            tables: names.flatMap((n) => [
              {
                sourcePath: path(n),
                destinationPath: path(n + '_before_uuid_v2'),
                replaceDestination: false,
              },
              {
                sourcePath: path(n + '_uuid_v2_new'),
                destinationPath: path(n),
                replaceDestination: false,
              },
            ]),
          },
          options(),
        ),
      );
      for (const n of names) {
        const info = await describe(n);
        if (
          !refs[n].every(
            (k) => typeId(info.columns.find((c) => c.name === k)) === 4611,
          )
        )
          throw new Error('Final schema verification failed.');
      }
      console.log(
        'Applied and verified UUID schema; original tables retained as *_before_uuid_v2.',
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
