import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { defaultRoute, objectsFrom, planRoute, routeAlternatives } from '../engine.mjs';
import { chineseItinerary, chineseItineraryText } from '../public/chinese-itinerary.mjs';

const load = file=>readFile(new URL('../data/'+file+'.json',import.meta.url),'utf8').then(JSON.parse);
const [catalog,audit] = await Promise.all([load('catalog'),load('demo-audit-change')]);
const places = objectsFrom(catalog,{audit});

test('localizes the changed China-group itinerary from the selected plan', () => {
  const alternatives = routeAlternatives(places,defaultRoute);
  const split = alternatives.find(variant=>variant.plan.days.some(day=>day.stops.some(stop=>stop.split)));
  const itinerary = chineseItinerary(split.plan);
  assert.deepEqual(itinerary.days.map(day=>day.title),['第 1 天 · 弗拉基米尔','第 2 天 · 苏兹达尔']);
  assert.equal(itinerary.days[0].date,'2026年11月21日');
  assert.match(itinerary.group,/18 人/);
  assert.match(itinerary.status,/演示数据.*预订尚未确认/);
  assert.ok(itinerary.days[0].stops.some(stop=>stop.category==='团体用餐'));
  assert.ok(itinerary.days[0].stops.some(stop=>stop.category==='住宿和入住'));
  assert.ok(itinerary.days[1].stops.some(stop=>stop.category==='交通（预计时间）'));
  const kremlin = itinerary.days[1].stops.find(stop=>stop.name==='苏兹达尔克里姆林宫');
  assert.match(kremlin.details.join(' '),/分两场，每组最多 9 人/);
  const text = chineseItineraryText(itinerary);
  assert.match(text,/出发前请确认/);
  assert.match(text,/随团中文翻译/);
  assert.match(text,/客房余量/);
  assert.match(text,/Суздальский кремль/);
  assert.ok(text.includes(kremlin.source));
});

test('keeps gaps and reservations visible and omits localization for the domestic group', () => {
  const plan = planRoute(places,{...defaultRoute,demo:false,access:true});
  const itinerary = chineseItinerary(plan);
  assert.match(itinerary.status,/尚待确认/);
  assert.match(chineseItineraryText(itinerary),/待确认：.*团体午餐地点.*住宿安排/);
  assert.match(chineseItineraryText(itinerary),/无障碍通行条件/);
  const site = {type:'visit',name:'Пример',cn:'参观点',start:'10:00',end:'11:00',booking:'reservation'};
  const reserved = chineseItinerary({...plan,days:[{...plan.days[0],stops:[site]}]});
  assert.match(reserved.days[0].stops[0].details.join(' '),/须预约.*确认预约是否成功/);
  assert.equal(chineseItinerary({...plan,settings:{...plan.settings,market:'ru'}}),null);
});
