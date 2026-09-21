// Run after compiling the backend: node --test test/match-create.dto.test.mjs
import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import { CreateMatchInStageDto } from '../dist/matches/dto/createMatch.dto.js';

test('nested match endpoint accepts stageId from route, with normal body validation intact', async () => {
  const dto = Object.assign(new CreateMatchInStageDto(), {
    matchDate: '2026-09-28T12:00:00.000Z',
    cityId: '219a4364-0d97-462e-854c-4d7940900f3f',
    tourNumber: 1,
  });
  assert.deepEqual(await validate(dto), []);
  dto.cityId = 'invalid';
  assert.ok((await validate(dto)).some(error => error.property === 'cityId'));
});
