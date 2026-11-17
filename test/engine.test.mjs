import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assess, attributeChanges, defaultRoute, impacts, objectsFrom, planRoute, portfolioImpact, reviewRoute, routeAlternatives, routeSettings } from '../engine.mjs';

const load = name => JSON.parse(readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const catalog = load('catalog');
const snapshot = load('snapshot');
const baseline = load('demo-audit');
const changedAudit = load('demo-audit-change');
const state = {...snapshot,audit:baseline};

test('a current programme issue is attributed only to the matching latest condition change',()=>{
  const id = 'suzdal-kremlin';
  const changed = {...state,audit:changedAudit};
  const places = objectsFrom(catalog,changed);
  const programs = impacts(catalog,changed,baseline,snapshot.wiki);
  const reduction = {id,key:'capacity',demo:true,before:baseline.objects[id].capacity,after:changedAudit.objects[id].capacity};
  const restored = {...reduction,before:reduction.after,after:reduction.before};
  const loweredAgain = {...reduction,before:16};
  const unrelated = {id,key:'minutes',demo:true,before:1,after:changedAudit.objects[id].minutes};
  const [latest, older, repeated, other] = attributeChanges([reduction,restored,reduction,unrelated],places,programs);
  assert.deepEqual(latest.affectedProgramIds,['group-cn']);
  assert.equal(older.affectedProgramIds,undefined);
  assert.equal(repeated.affectedProgramIds,undefined);
  assert.deepEqual(other.affectedProgramIds,[]);
  assert.deepEqual(attributeChanges([loweredAgain],places,programs)[0].affectedProgramIds,[]);
  const current = attributeChanges([restored,reduction],objectsFrom(catalog,state),impacts(catalog,state,baseline,snapshot.wiki));
  assert.deepEqual(current[0].affectedProgramIds,[]);
});

test('one update can introduce two independent reasons for revising the same itinerary',()=>{
  const id = 'suzdal-kremlin';
  const audit = structuredClone(baseline);
  Object.assign(audit.objects[id],{capacity:12,off:[0]});
  const changed = {...state,audit};
  const places = objectsFrom(catalog,changed);
  const programs = impacts(catalog,changed,baseline,snapshot.wiki);
  const changes = ['capacity','off'].map(key=>({id,key,demo:true,at:'2026-11-18T09:00:00Z',
    before:baseline.objects[id][key],after:audit.objects[id][key]}));
  const [capacity,closure] = attributeChanges(changes,places,programs);
  assert.deepEqual(capacity.affectedProgramIds,['group-cn']);
  assert.ok(closure.affectedProgramIds.includes('group-cn'));
});

test('links the latest Wikidata identity conflict only to routes with that unresolved stop',()=>{
  const id = 'suzdal-kremlin';
  const {qid} = catalog.find(place=>place.id===id);
  const before = snapshot.wiki[qid].wikiName;
  const after = 'Другая запись';
  const changed = {...state,audit:changedAudit, wiki:{...snapshot.wiki,[qid]:{...snapshot.wiki[qid],wikiName:after}}};
  const programs = impacts(catalog,changed,baseline,snapshot.wiki);
  programs.push({id:'elsewhere',issues:[{id:'wood',status:'unknown'}]});
  const place = objectsFrom(catalog,changed);
  const change = {id,key:'wikiName',before,after,source:'Wikidata',url:'https://www.wikidata.org/wiki/'+qid,at:'2026-11-18T09:00:00Z'};
  const older = {...change,before:after,after:before,at:'2026-11-18T08:00:00Z'};
  const [current,old] = attributeChanges([change,older],place,programs);
  assert.deepEqual(current.affectedProgramIds,['group-cn','group-small']);
  assert.equal(current.url,change.url);
  assert.equal(current.at,change.at);
  assert.equal(old.affectedProgramIds,undefined);
  assert.equal(attributeChanges([{...change,before:'Другая старая запись'}],place,programs)[0].affectedProgramIds,undefined);
});

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
