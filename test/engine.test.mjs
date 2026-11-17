import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assess, defaultRoute, impacts, objectsFrom, planRoute, portfolioImpact, reviewRoute, routeAlternatives, routeSettings } from '../engine.mjs';

const load = name => JSON.parse(readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const catalog = load('catalog');
const snapshot = load('snapshot');
const baseline = load('demo-audit');
const changedAudit = load('demo-audit-change');
const state = {...snapshot,audit:baseline};

test('the change affects the larger group and measures all scenarios on the same portfolio',()=>{
  const changed = {...state,audit:changedAudit};
  const [large,small] = impacts(catalog,changed,baseline,snapshot.wiki);
  assert.equal(large.affected,true);
  assert.deepEqual(large.removed.map(stop=>stop.id),['suzdal-kremlin']);
  assert.equal(large.currentPlan.completeness,true);
  assert.equal(small.affected,false);
  const comparison = portfolioImpact(catalog,changed,baseline,snapshot.wiki,true);
  assert.deepEqual([comparison.total,comparison.baselineCount,comparison.currentCount],[2,2,1]);
  assert.deepEqual(comparison.scenarios.map(({id,feasibleCount,delta})=>[id,feasibleCount,delta]),[
    ['replacement',2,1], ['split',2,1], ['capacity',2,1],
  ]);
  for (const scenario of comparison.scenarios) {
    assert.deepEqual(scenario.programs.map(({id,before,after})=>[id,before,after]),[
      ['group-cn',false,true], ['group-small',true,true],
    ]);
  }
  assert.equal(portfolioImpact(catalog,changed,baseline,snapshot.wiki,false).total,0);
});

test('complete alternatives are repeatable and an unchanged selected schedule stays on the map',()=>{
  const changed = {...state,audit:changedAudit};
  const places = objectsFrom(catalog,changed);
  const choices = routeAlternatives(places,defaultRoute);
  assert.deepEqual(choices,routeAlternatives(places,defaultRoute));
  assert.equal(new Set(choices.map(choice=>choice.id)).size,choices.length);
  const split = choices.find(({plan})=>plan.days.some(day=>day.stops.some(stop=>stop.split)));
  assert.ok(split);
  assert.ok(split.plan.assumptions.some(note=>note.includes('Два сеанса')));
  for (const {plan} of choices) assert.equal(reviewRoute(places,plan).feasible,true);
  const selected = {...choices.at(-1),id:'saved',subtitle:'Сохранённый вариант',settings:defaultRoute,baseline:choices.at(-1).plan};
  const monitored = impacts(catalog,{...changed,savedRoutes:[selected]},baseline,snapshot.wiki).at(-1);
  assert.equal(monitored.affected,false);
  assert.deepEqual(monitored.currentPlan,selected.baseline);
});

test('the planner looks ahead across opening windows and checks lunch after the third-day return',()=>{
  const audit = structuredClone(baseline);
  Object.assign(audit.objects.dmitrovsky,{minutes:210});
  Object.assign(audit.objects.palaty,{minutes:30,hours:[10,12]});
  Object.assign(audit.objects['amaks-food'],{hours:[12,14]});
  const allowed = new Set(['dmitrovsky','palaty','amaks','amaks-food']);
  const places = objectsFrom(catalog.filter(place=>place.city!=='Владимир'||allowed.has(place.id)),{...state,audit});
  const plan = planRoute(places,defaultRoute);
  assert.equal(plan.completeness,true);
  assert.deepEqual(plan.days[0].stops.map(stop=>stop.id),['palaty','amaks-food','dmitrovsky','amaks']);

  const threeDays = planRoute(places,{...defaultRoute,days:3});
  const [arrival,atKideksha,returning,lunch] = threeDays.days[2].stops;
  assert.equal(threeDays.completeness,true);
  assert.ok(arrival.end<atKideksha.start && atKideksha.end<returning.start && returning.end<lunch.start);
  assert.equal(lunch.id,'ogurec');
  audit.objects.ogurec.off = [1];
  const updated = planRoute(objectsFrom(catalog,{...state,audit}),{...defaultRoute,days:3});
  assert.deepEqual(updated.days[2].missing,['Место для обеда']);
});

test('real conditions respect validity dates and nature formats require matching stops',()=>{
  const settings = {...defaultRoute,demo:false};
  assert.deepEqual(routeAlternatives(objectsFrom(catalog,state),settings),[]);
  const verifiedAudit = {objects:Object.fromEntries(Object.entries(baseline.objects).map(([id,audit])=>[id,{
    ...audit,booking:'reservation',verifiedAt:'2026-11-17T09:00:00Z',validUntil:'2026-11-22',sourceUrl:'https://example.com/audit',
  }]))};
  const places = objectsFrom(catalog,{...state,verifiedAudit});
  assert.equal(planRoute(places,settings).completeness,true);
  assert.equal(planRoute(places,{...settings,days:3}).completeness,false);
  assert.equal(assess(places[0],{...settings,date:'2026-11-01'}).status,'unknown');
  const outdoor = routeSettings({...settings,theme:'hike'});
  assert.equal(outdoor.theme,'hike');
  assert.match(planRoute(places,outdoor).themeNote,/нет подтверждённых/);
  assert.deepEqual(routeAlternatives(places,outdoor),[]);
});

test('restoring a recorded limit is a conditional scenario for verified programmes',()=>{
  const settings = {...defaultRoute,demo:false};
  const verifiedAudit = {objects:Object.fromEntries(Object.entries(baseline.objects).map(([id,audit])=>[id,{
    ...audit,booking:'reservation',verifiedAt:'2026-11-17T09:00:00Z',validUntil:'2026-12-22',sourceUrl:'https://example.com/audit',
  }]))};
  const original = planRoute(objectsFrom(catalog,{...state,verifiedAudit}),settings);
  assert.ok(original.completeness);
  const savedRoutes = [{id:'verified',title:'Согласованный вариант',subtitle:'Группа из Китая',settings,baseline:original}];
  const updated = structuredClone(verifiedAudit);
  updated.objects['suzdal-kremlin'].capacity = 12;
  const changed = {...state,verifiedAudit:updated,savedRoutes};
  const comparison = portfolioImpact(catalog,changed,baseline,snapshot.wiki,false);
  assert.deepEqual([comparison.total,comparison.baselineCount,comparison.currentCount],[1,1,0]);
  assert.deepEqual(comparison.scenarios.map(({id,delta})=>[id,delta]),[['replacement',1],['capacity',1]]);
  updated.objects['suzdal-kremlin'].off = [0];
  assert.equal(portfolioImpact(catalog,changed,baseline,snapshot.wiki,false).scenarios[1].delta,0);
});
