// Validate actual SDK query rendering without network or credentials.
import 'reflect-metadata';
import assert from 'node:assert/strict';

import { yql, fragment, identifier, join, unsafe } from '../node_modules/@ydbjs/query/dist/yql.js';
import { ScheduleRepository } from '../dist/schedule/repository/schedule.repository.js';
const queries = [];
const tx = async (strings, ...values) => {
  queries.push(yql(strings, ...values));
  return [[]];
};
const sql = {
  fragment,
  identifier,
  join,
  unsafe,
  async begin(options, fn) {
    assert(
      ['serializableReadWrite', 'snapshotReadOnly'].includes(options.isolation),
    );
    return fn(tx);
  },
};
const repository = new ScheduleRepository(sql);
await repository.transaction(async (db) => {
  const stamp = await db.stamp();
  await db.save(
    'tournaments',
    {
      ...stamp,
      id: '18446744073709551615',
      name: "Кубок '; DROP TABLE matches; --",
      season: '2026',
      type: 'CUP',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      templateId: null,
    },
    true,
  );
  await db.list('stages', {
    tournamentId: '18446744073709551615',
    parentStageId: null,
  });
  await db.remove('matches', '18446744073709551615');
});
assert.match(queries[0].text, /INSERT INTO `tournaments` \(`id`, `name`,/);
assert.match(queries[0].text, /VALUES \(\$p0, \$p1,/);
assert(!queries[0].text.includes('DROP TABLE'));
assert.equal(Object.keys(queries[0].params).length, 8);
assert.match(
  queries[1].text,
  /`tournamentId` = \$p0 AND `parentStageId` IS NULL/,
);
assert.match(queries[2].text, /DELETE FROM `matches` WHERE id = \$p0/);
assert.equal(queries[0].params.$p0.value, 18446744073709551615n);
console.log(
  'PASS repository: SDK SQL rendering, typed Uint64, bound values, nullable columns, filters, transactions',
);
