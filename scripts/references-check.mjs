// Run against the local server with --env-file=.env. No credentials are written.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const mode = process.argv[2],
  file = process.argv[3];
assert(
  ['create', 'verify-cleanup'].includes(mode) && file,
  'Specify create|verify-cleanup and fixture path',
);
const response = await fetch('http://localhost:3000/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  }),
});
const auth = await response.json();
assert(response.ok && auth.access_token, 'Local authentication failed');
async function api(path, method = 'GET', body, status = 200) {
  const r = await fetch('http://localhost:3000' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'ru',
      Authorization: `Bearer ${auth.access_token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => null);
  assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
if (mode === 'create') {
  const f = { name: 'Проверка справочников ' + randomUUID() };
  const save = () => writeFileSync(file, JSON.stringify(f), { mode: 0o600 });
  save();
  assert.equal((await fetch('http://localhost:3000/cities')).status, 401);
  await api('/cities', 'POST', { name: '   ' }, 400);
  await api('/teams', 'POST', { name: f.name, cityId: 0 }, 422);
  f.city = await api('/cities', 'POST', { name: f.name }, 201);
  save();
  assert.match(f.city.id, /^[0-9a-f-]{36}$/);
  await api(
    '/cities',
    'POST',
    { name: '  ' + f.name.toLowerCase() + ' ' },
    409,
  );
  f.team = await api(
    '/teams',
    'POST',
    { name: f.name, cityId: f.city.id },
    201,
  );
  save();
  await api(
    '/teams',
    'POST',
    { name: f.name.toUpperCase(), cityId: f.city.id },
    409,
  );
  await api('/cities/' + f.city.id, 'DELETE', undefined, 409);
  await api('/teams/' + f.team.id, 'PUT', { cityId: randomUUID() }, 422);
  await api('/teams/' + f.team.id, 'PUT', { cityId: 9007199254740992 }, 422);
  f.team = await api('/teams/' + f.team.id, 'PUT', {
    name: f.name + ' обновлено',
  });
  save();
  f.city = await api('/cities/' + f.city.id, 'PUT', {
    name: f.name + ' обновлено',
  });
  save();
  assert(
    (await api('/cities?search=' + encodeURIComponent(f.name))).some(
      (c) => c.id === f.city.id,
    ),
  );
  f.tournament = await api(
    '/tournaments',
    'POST',
    {
      name: f.name,
      season: 'Проверка',
      type: 'LEAGUE',
      startDate: '2026-09-19',
      endDate: '2026-12-31',
    },
    201,
  );
  save();
  f.stage = await api(
    '/tournaments/' + f.tournament.id + '/stages',
    'POST',
    { name: 'Группа', type: 'GROUP', format: 'ROUND_ROBIN', sortOrder: 0 },
    201,
  );
  save();
  f.slot = await api(
    '/tournaments/' + f.tournament.id + '/team-slots',
    'POST',
    { stageId: f.stage.id, slotName: 'A1', teamId: String(f.team.id) },
    201,
  );
  save();
  await api('/teams/' + f.team.id, 'DELETE', undefined, 409);
  f.template = await api(
    '/templates',
    'POST',
    {
      name: f.name,
      version: 1,
      isActive: true,
      schema: {
        name: f.name,
        type: 'LEAGUE',
        cityId: String(f.city.id),
        stages: [
          {
            key: 'group',
            name: 'Группа',
            type: 'GROUP',
            format: 'ROUND_ROBIN',
            slots: [{ name: 'A', teamId: String(f.team.id) }, { name: 'B' }],
          },
        ],
      },
    },
    201,
  );
  save();
  console.log(
    'PASS CRUD, auth, duplicate/invalid input protection, city/team integrity, slot and template references. Restart server, then verify-cleanup.',
  );
} else {
  const f = JSON.parse(readFileSync(file, 'utf8'));
  assert.deepEqual(await api('/cities/' + f.city.id), f.city);
  assert.deepEqual(await api('/teams/' + f.team.id), f.team);
  const slots = await api('/tournaments/' + f.tournament.id + '/team-slots');
  assert.equal(slots.find((s) => s.id === f.slot.id).teamId, String(f.team.id));
  await api('/team-slots/' + f.slot.id, 'DELETE');
  await api('/teams/' + f.team.id, 'DELETE', undefined, 409); // Template still owns the reference.
  await api('/templates/' + f.template.id, 'DELETE');
  await api('/stages/' + f.stage.id, 'DELETE');
  await api('/tournaments/' + f.tournament.id, 'DELETE');
  await api('/teams/' + f.team.id, 'DELETE');
  await api('/cities/' + f.city.id, 'DELETE', undefined, 204);
  await api('/teams/' + f.team.id, 'GET', undefined, 404);
  await api('/cities/' + f.city.id, 'GET', undefined, 404);
  unlinkSync(file);
  console.log(
    'PASS records and schedule links survived process restart; temporary data removed.',
  );
}
