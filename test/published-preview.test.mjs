import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { defaultRoute, groupApplicationDeadline, objectsFrom, planRoute, previewPublishedRoute, publishedHours, routeAlternatives, verifyDraftStops } from '../engine.mjs';
import { mergePublishedConditions } from '../published-conditions.mjs';
import { chineseItinerary, chineseItineraryText } from '../public/chinese-itinerary.mjs';
import { createLocalPlaceCatalog } from '../city-overview.mjs';
import { draftItinerary } from '../nationwide.mjs';

const load = name=>JSON.parse(readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));
const catalog=load('catalog');
const feeds=['published-vladimir','published-suzdal','published-hospitality','published-regional'].map(load);
const places=objectsFrom(catalog,{publishedConditions:mergePublishedConditions(catalog,feeds)});
const working={...defaultRoute,demo:false};
const minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3));

test('draft verification checks the exact day and time, including aliases from the map catalog',()=>{
  const stops=[{id:'osm-cathedral',start:'10:15',end:'10:50'}, {id:'golden-gate',start:'14:00',end:'14:30'},
    {id:'new-place',start:'16:00',end:'17:00'}];
  const draft={settings:{...working,date:'2026-11-20'},places:[{id:'osm-cathedral',sourceIds:['dmitrovsky']}],
    plan:{days:[{date:'2026-11-20',stops:[]},{date:'2026-11-21',stops}]}};
  const [empty,checks]=verifyDraftStops(draft,new Map(places.map(place=>[place.id,place])));
  assert.deepEqual(empty,[]);
  assert.deepEqual(checks.map(check=>[check.id,check.status]),[
    ['osm-cathedral','blocked'],['golden-gate','unknown'],['new-place','unknown'],
  ]);
  assert.deepEqual(checks[0].hours.windows,[[660,1140]]);
  assert.equal(checks[0].deadline.date,'2026-11-14');
  assert.ok(checks[1].notes.length);
  assert.equal(checks[2].hours,null);
});

test('the draft uses the published visit window before inserting the required museum',async()=>{
  const local=createLocalPlaceCatalog(catalog,load('map'));
  const officialCatalog=new Map(places.map(place=>[place.id,place]));
  const draft=await draftItinerary({cityId:'473247',date:'2026-11-21',size:8,days:2,requiredPlaceIds:['dmitrovsky']},{
    local,officialCatalog,fetchImpl:async()=>Response.json({elements:[],query:{geosearch:[]}}),
  });
  assert.equal(draft.plan.required[0].scheduled,true);
  const checks=verifyDraftStops(draft,officialCatalog).flat();
  assert.ok(!checks.some(check=>check.id==='dmitrovsky' && check.status==='blocked'));
  const saturday=draft.plan.days[0].stops.find(stop=>stop.id==='dmitrovsky');
  if (saturday) assert.ok(saturday.start>='11:00');
});

test('published preview is actionable without becoming approved supplier evidence',()=>{
  const strict = planRoute(places,working);
  assert.equal(strict.completeness,false);
  assert.equal(strict.days.flatMap(day=>day.stops).some(stop=>stop.id),false);
  assert.deepEqual(routeAlternatives(places,working),[]);
  const preview=previewPublishedRoute(places,working);
  assert.equal(preview.completeness,false);
  assert.equal(preview.publishedPreview,true);
  assert.deepEqual(preview.days.map(day=>day.city),['Владимир','Суздаль']);
  for (const [index,day] of preview.days.entries()) {
    assert.ok(day.stops.some(stop=>stop.type==='visit'));
    for (const stop of day.stops.filter(stop=>stop.id)) {
      const spot=places.find(place=>place.id===stop.id);
      const hours=publishedHours(spot,working.date,index);
      assert.ok(hours.windows.some(([open,close])=>minutes(stop.start)>=open && minutes(stop.end)<=close &&
        minutes(stop.start)<=close-(hours.lastEntryMinutes ?? 0)));
      assert.equal(stop.provisional,true);
      assert.equal(stop.sourceUrl,hours.url);
      assert.equal(stop.capacity,undefined);
      assert.equal(stop.booking,undefined);
      assert.equal(stop.verifiedAt,undefined);
    }
  }
  const chinese=chineseItineraryText(chineseItinerary(preview));
  assert.match(chinese,/按已公布开放时间拟定的草案/u);
  assert.match(chinese,/预约待供应方确认/u);
  assert.doesNotMatch(chinese,/场馆接待上限/u);
  assert.equal(previewPublishedRoute(places,defaultRoute),null);
});

test('the provisional timetable omits explicit group limits and expired museum hours',()=>{
  const restricted=structuredClone(places);
  const cathedral=restricted.find(place=>place.id==='dmitrovsky');
  cathedral.publishedConditions.limits=[{max:12,url:cathedral.url,text:'Условия группы'}];
  const stops=previewPublishedRoute(restricted,working).days.flatMap(day=>day.stops);
  assert.ok(!stops.some(stop=>stop.id===cathedral.id));
  const future=previewPublishedRoute(restricted,{...working,date:'2027-01-18'});
  assert.ok(!future?.days.flatMap(day=>day.stops).some(stop=>stop.id===cathedral.id));
});

test('applies the museum group application deadline only during the published offer',()=>{
  const kremlin=places.find(place=>place.id==='suzdal-kremlin');
  const deadline=groupApplicationDeadline(kremlin,'2026-11-22');
  assert.equal(deadline.date,'2026-11-15');
  assert.equal(deadline.days,7);
  assert.match(deadline.url,/dogovor_oferti_2026_/u);
  assert.equal(groupApplicationDeadline(kremlin,'2025-12-28'),null);
  assert.equal(groupApplicationDeadline(kremlin,'2027-01-04'),null);
  assert.equal(groupApplicationDeadline(places.find(place=>place.id==='ogurec'),'2026-11-22'),null);
});
