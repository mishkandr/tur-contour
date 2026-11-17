import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { assess, defaultRoute, objectsFrom, planRoute, publishedHours, reviewRoute, routeAlternatives } from '../engine.mjs';
import { mergePublishedConditions } from '../published-conditions.mjs';

const load = name => readFile(new URL('../data/'+name+'.json',import.meta.url),'utf8').then(JSON.parse);
const [catalog,vladimir,suzdal,hospitality,baseAudit] = await Promise.all(
  ['catalog','published-vladimir','published-suzdal','published-hospitality','demo-audit'].map(load),
);
const published = mergePublishedConditions(catalog,[vladimir,suzdal,hospitality]);
const settings = {...defaultRoute,demo:false};
const places = objectsFrom(catalog,{audit:baseAudit,publishedConditions:published});
const getPlace = id => places.find(place => place.id === id);

test('every Vladimir–Suzdal venue has evidence or specific outstanding questions', () => {
  const corridor = places.filter(place => ['Владимир','Суздаль'].includes(place.city));
  assert.equal(corridor.length,17);
  assert.ok(corridor.every(place => place.publishedConditions?.clarify.length));
  assert.equal(getPlace('golden-gate').publishedConditions.schedule,undefined);
  assert.equal(getPlace('amaks').publishedConditions.schedule,undefined);
  assert.match(getPlace('amaks').publishedConditions.booking.text,/брон|заяв/iu);
});

test('the published calendar observes day-of-week, dates, breaks and cutoffs', () => {
  const saturday = publishedHours(getPlace('dmitrovsky'),settings.date);
  assert.deepEqual(saturday.windows,[[660,1140]]);
  assert.equal(saturday.lastEntryMinutes,30);
  assert.deepEqual(publishedHours(getPlace('palaty'),'2026-11-23').windows,[]);
  assert.deepEqual(publishedHours(getPlace('history'),'2026-11-04').windows,[[600,1080]]);
  assert.deepEqual(publishedHours(getPlace('history'),'2026-11-05').windows,[]);
  assert.deepEqual(publishedHours(getPlace('stoletov'),'2026-11-13').windows,[[600,720],[870,1080]]);
  assert.deepEqual(publishedHours(getPlace('suzdal-kremlin'),settings.date,1).windows,[[600,1080]]);
  assert.equal(publishedHours(getPlace('suzdal-kremlin'),'2026-12-30').windows,null);
  assert.deepEqual(publishedHours(getPlace('amaks-food'),settings.date).windows,[[750,900]]);
});

test('public facts cannot become group confirmation or artificial limits', () => {
  const wood = assess(getPlace('wood'),{...settings,size:35},1);
  assert.equal(wood.status,'unknown');
  assert.ok(getPlace('wood').publishedConditions.limits.some(fact => fact.text.includes('25') && fact.max === undefined));
  assert.equal(assess(getPlace('wood'),{...settings,date:'2026-11-23'}).status,'blocked');
  assert.match(assess(getPlace('wood'),{...settings,date:'2026-12-30'}).reasons[0],/не покрывает/);
  assert.deepEqual(routeAlternatives(places,settings),[]);
  assert.ok(routeAlternatives(places,defaultRoute).length);
});

test('a verified plan respects public windows, including the last entry time', () => {
  const makeVerified = entry => ({...entry,verifiedAt:'2026-11-17',validUntil:'2026-12-29',booking:'reservation'});
  const verifiedPlaces = places.map(place=>({
    ...place,verifiedAudit:place.audit ? makeVerified(place.audit) : null,
  }));
  const route = planRoute(verifiedPlaces,settings);
  assert.equal(route.days[0].stops.find(stop => stop.id === 'dmitrovsky')?.start,'11:00');
  const meal = route.days[0].stops.find(stop => stop.id === 'amaks-food');
  assert.ok(meal && meal.start >= '12:30' && meal.end <= '15:00');
  const museum = getPlace('suzdal-kremlin');
  const lateStop = {id:museum.id,name:museum.name,start:'17:05',end:'17:25'};
  const latePlan = {settings,completeness:true,days:[{city:'Суздаль',stops:[lateStop]}]};
  const checked = reviewRoute([{...museum,verifiedAudit:makeVerified({...museum.audit,minutes:20})}],latePlan);
  assert.equal(checked.feasible,true); // Saturday admission ends at 18:00.
  assert.equal(reviewRoute([{...museum,verifiedAudit:makeVerified({...museum.audit,minutes:20})}],{
    ...latePlan,settings:{...settings,date:'2026-11-22'},
  }).feasible,false);
});
