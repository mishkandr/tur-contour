import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretBrief, parseBrief } from '../planner-brief.mjs';

const reference = '2026-11-17';

test('extracts the user date, group, interests, required places and visit deadline between other numbers', () => {
  const result = parseBrief('Казань для 12 человек на три дня с 21 ноября. Музеи и пешие прогулки, только до обеда. Обязательно «Казанский кремль».',reference);
  assert.equal(result.days,3);
  assert.equal(result.size,12);
  assert.equal(result.date,'2026-11-21');
  assert.equal(result.visitDeadline,'12:00');
  assert.deepEqual(result.interests,['museum','hike']);
  assert.deepEqual(result.required,['Казанский кремль']);
});

test('reads English and Simplified Chinese without creating parameters the user omitted', async () => {
  const en = parseBrief('November 21, 2026: three days for twelve people, museums. Walking only.',reference);
  assert.equal(en.date,'2026-11-21');
  assert.equal(en.transport,'walking');
  const {parsed,mode} = await interpretBrief('喀山11月21日，三天，12人，需要博物馆和无障碍通行。',{referenceDate:reference});
  assert.equal(parsed.date,'2026-11-21');
  assert.equal(parsed.days,3);
  assert.equal(parsed.size,12);
  assert.equal(parsed.access,true);
  assert.equal(parsed.market,null);
  assert.equal(mode,'rules');
});

test('never converts a no-museums instruction into a positive museum preference', () => {
  const parsed = parseBrief('Казань, семейная программа с парками, без музеев.',reference);
  assert.deepEqual(parsed.excludedInterests,['museum']);
  assert.deepEqual(parsed.interests,['family','nature']);
});

test('treats a relaxed pace separately from walking or hiking', () => {
  const parsed = parseBrief('Неспешный маршрут с музеями и на автобусе.',reference);
  assert.deepEqual(parsed.interests,['museum']);
  assert.equal(parsed.pace,'relaxed');
  assert.equal(parsed.transport,'car');
});

test('reports an unsupported spelled-out duration in every interface language', () => {
  for (const request of ['Казань на четыре дня','Four days in Kazan','喀山四天']) {
    assert.equal(parseBrief(request,reference).requestedDays,4);
    assert.equal(parseBrief(request,reference).days,null);
  }
});
