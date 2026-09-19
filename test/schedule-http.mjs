// Run after npm run build: node test/schedule-http.mjs
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as Crud from '../dist/schedule/schedule-crud.service.js';
import * as Bracket from '../dist/schedule/bracket-resolver.service.js';
import * as Factory from '../dist/schedule/tournament-factory.service.js';
import { ScheduleGeneratorService } from '../dist/schedule/schedule-generator.service.js';
import { ScheduleRepository } from '../dist/schedule/repository/schedule.repository.js';
import * as Controllers from '../dist/schedule/schedule.controllers.js';
import * as Tokens from '../dist/schedule/tokens.js';
import { TEAM_SERVICE } from '../dist/team/tokens.js';
import { CITY_SERVICE } from '../dist/city/tokens.js';
import { JwtAuthGuard } from '../dist/auth/guards/auth.guard.js';
let counter = 1;
const tables = new Map();
const store = {
  async stamp() {
    const now = new Date().toISOString();
    return { id: String(counter++), createdAt: now, updatedAt: now };
  },
  async list(table, where = {}) {
    return structuredClone(
      [...(tables.get(table)?.values() ?? [])].filter((x) =>
        Object.entries(where).every(([k, v]) => x[k] === v),
      ),
    );
  },
  async get(table, id) {
    const value = tables.get(table)?.get(id);
    if (!value) throw new NotFoundException();
    return structuredClone(value);
  },
  async save(table, value) {
    if (!tables.has(table)) tables.set(table, new Map());
    tables.get(table).set(value.id, structuredClone(value));
    return value;
  },
  async remove(table, id) {
    tables.get(table)?.delete(id);
  },
};
const repo = {
  async read(fn) {
    return fn(store);
  },
  async transaction(fn) {
    const before = structuredClone(tables);
    try {
      return await fn(store);
    } catch (e) {
      tables.clear();
      for (const [k, v] of before) tables.set(k, v);
      throw e;
    }
  },
};
const pairs = [
  ['TOURNAMENTS_SERVICE', Crud.ScheduleTournamentService],
  ['MATCHES_SERVICE', Crud.ScheduleMatchService],
  ['STAGES_SERVICE', Crud.StageService],
  ['TEAM_SLOTS_SERVICE', Crud.TeamSlotService],
  ['TEMPLATES_SERVICE', Crud.TemplateService],
  ['SCHEDULE_GENERATOR_SERVICE', ScheduleGeneratorService],
  ['STANDINGS_SERVICE', Bracket.StandingsService],
  ['BRACKET_RESOLVER_SERVICE', Bracket.BracketResolverService],
  ['BRACKET_SLOTS_SERVICE', Bracket.BracketSlotService],
  ['TOURNAMENT_FACTORY_SERVICE', Factory.TournamentFactoryService],
];
const module = await Test.createTestingModule({
  controllers: Object.values(Controllers),
  providers: [
    ...Object.values(Crud),
    ...Object.values(Bracket),
    ...Object.values(Factory),
    ScheduleGeneratorService,
    { provide: ScheduleRepository, useValue: repo },
    { provide: TEAM_SERVICE, useValue: { findOne: async (id) => ({ id }) } },
    { provide: CITY_SERVICE, useValue: { findOne: async (id) => ({ id }) } },
    ...pairs.map(([token, service]) => ({
      provide: Tokens[token],
      useExisting: service,
    })),
  ],
})
  .overrideGuard(JwtAuthGuard)
  .useValue({
    canActivate: (ctx) =>
      ctx.switchToHttp().getRequest().headers.authorization === 'Bearer test',
  })
  .compile();
const app = module.createNestApplication({ logger: false });
await app.listen(0, '127.0.0.1');
const base = await app.getUrl();
async function request(path, method = 'GET', body, auth = true) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer test' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    data: await response.json().catch(() => null),
  };
}
try {
  assert.equal(
    (await request('/tournaments', 'GET', undefined, false)).status,
    403,
  );
  assert.equal(
    (await request('/tournaments', 'POST', { name: 'Invalid' })).status,
    400,
  );
  const t = await request('/tournaments', 'POST', {
    name: 'Smoke',
    season: '2026',
    type: 'LEAGUE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });
  assert.equal(t.status, 201);
  assert.equal(typeof t.data.id, 'string');
  const s = await request(`/tournaments/${t.data.id}/stages`, 'POST', {
    name: 'Группа',
    type: 'GROUP',
    format: 'ROUND_ROBIN',
    sortOrder: 0,
    settings: { rounds: 2 },
  });
  assert.equal(s.status, 201);
  for (let i = 1; i <= 4; i++)
    assert.equal(
      (
        await request(`/tournaments/${t.data.id}/team-slots`, 'POST', {
          stageId: s.data.id,
          slotName: `Слот ${i}`,
          teamId: String(i),
          seed: i,
        })
      ).status,
      201,
    );
  assert.equal(
    (
      await request(`/tournaments/${t.data.id}/generate-schedule`, 'POST', {
        cityId: '1',
      })
    ).status,
    201,
  );
  const calendar = await request(
    `/tournaments/${t.data.id}/calendar`,
    'GET',
    undefined,
    false,
  );
  assert.equal(calendar.status, 200);
  assert.equal(calendar.data.matches.length, 12);
  assert.equal(
    (
      await request(`/tournaments/${t.data.id}/generate-schedule`, 'POST', {
        cityId: '1',
      })
    ).status,
    409,
  );
  assert.equal(
    (await request(`/tournaments/${t.data.id}`, 'PUT', { name: null })).status,
    400,
  );
  assert.equal(
    (await request(`/stages/${s.data.id}/standings`)).data.length,
    4,
  );
  const schema = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().addBearerAuth(undefined, 'JWT-auth').build(),
  );
  assert(schema.paths['/tournaments/{id}/calendar'].get.security?.length !== 1);
  assert(schema.paths['/tournaments'].post.security.length === 1);
  assert(schema.paths['/stages/{stageId}/resolve']);
  assert(schema.paths['/templates/{id}']);
  assert(schema.paths['/tournaments/{tournamentId}/stages/tree']);
  console.log(
    `PASS HTTP: guard, validation, create, generate, standings, public calendar, conflict, Swagger (${Object.keys(schema.paths).length} paths)`,
  );
} finally {
  await app.close();
}
