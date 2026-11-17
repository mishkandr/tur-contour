import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { impacts, objectsFrom, recommendations } from '../engine.mjs';
import { mergePublishedConditions } from '../published-conditions.mjs';

const load = name => readFile(new URL('../data/'+name+'.json',import.meta.url),'utf8').then(JSON.parse);
const [catalog,snapshot,baseline,audit,vladimir,suzdal,hospitality] = await Promise.all(
  ['catalog','snapshot','demo-audit','demo-audit-change','published-vladimir','published-suzdal','published-hospitality'].map(load),
);
const state = {...snapshot,audit,publishedConditions:mergePublishedConditions(catalog,[vladimir,suzdal,hospitality])};

test('the management outlook links actual seasonality to a pilot with published schedules',()=>{
  const places = objectsFrom(catalog,state);
  const changes = impacts(catalog,state,baseline,snapshot.wiki);
  const actions = recommendations(places,state,changes);
  const [impact,pilot,interpretation,rooms] = actions;
  assert.match(impact.text,/Учебный сценарий.*Суздальский кремль.*12 чел.*18/);
  assert.equal(impact.sources[0].url,'/api/audit-version/2');
  assert.match(pilot.text,/декабрь.+ночёвок/);
  assert.match(pilot.text,/5\s*–\s*6 декабря 2026/);
  assert.match(pilot.text,/Для 10 из 12 позиций каталога/);
  assert.match(pilot.text,/Для оценки причин спада и спроса на конкретную программу нужны отдельные данные/);
  assert.ok(pilot.sources.some(source=>source.url===snapshot.stats.nights.source));
  assert.ok(pilot.sources.some(source=>source.url.includes('vladmuseum.ru')));
  assert.match(interpretation.text,/требуется подтверждение группового визита/);
  assert.match(rooms.text,/ночёвка в день 1 \(Владимир\)/);
  assert.match(rooms.text,/место для обеда в день 2 \(Суздаль\)/);
  assert.ok(rooms.sources.some(source=>source.url.includes('amaks-hotels.ru')));
});

test('expired published schedules do not yield a future pilot on the same dates',()=>{
  const expired = {...state,refreshedAt:'2027-01-01T08:00:00.000Z'};
  const [pilot] = recommendations(objectsFrom(catalog,expired),expired,[]);
  assert.match(pilot.text,/Сверить графики в обоих городах перед выбором дат/);
  assert.doesNotMatch(pilot.text,/5\s*–\s*6 декабря 2026/);
  assert.ok(pilot.sources.every(source=>!source.url.includes('vladmuseum.ru')));
});
