import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { assess, defaultRoute, objectsFrom, planRoute, publishedHours, reviewRoute, routeAlternatives, routeDirections, routeSettings } from '../engine.mjs';
import { mergePublishedConditions } from '../published-conditions.mjs';

const load = name => readFile(new URL('../data/'+name+'.json',import.meta.url),'utf8').then(JSON.parse);
const [catalog, base, regional, snapshot, evidence, map] = await Promise.all([
  'catalog','demo-audit','demo-audit-regional','snapshot','published-regional','map',
].map(load));
const places = objectsFrom(catalog,{...snapshot,audit:{objects:{...base.objects,...regional.objects}},
  publishedConditions:mergePublishedConditions(catalog,[evidence])});

test('keeps the original settings contract and checks a direction’s supported formats',()=>{
  assert.deepEqual(routeSettings({...defaultRoute,direction:'vladimir-suzdal'}),defaultRoute);
  assert.deepEqual(routeSettings({...defaultRoute,direction:'constructor'}),defaultRoute);
  assert.equal(routeSettings({...defaultRoute,direction:'murom',theme:'hike'}).theme,'pilgrimage');
  assert.equal(routeSettings({...defaultRoute,direction:'bogolyubovo',theme:'nature'}).theme,'nature');
});

test('builds distinct two- and three-day programmes with mapped and chronological stops',()=>{
  const visits={murom:'murom-monastery',gus:'maltsov-crystal',bogolyubovo:'nerl-trail'};
  for (const direction of routeDirections.slice(1)) {
    for (const days of [2,3]) {
      const settings = routeSettings({...defaultRoute,...direction.defaults,days,direction:direction.id,theme:direction.theme});
      const plan = planRoute(places,settings);
      assert.equal(plan.direction.id,direction.id);
      assert.equal(plan.days.length,days);
      assert.ok(plan.completeness,direction.id+' '+JSON.stringify(plan.days.map(day=>day.missing)));
      assert.ok(plan.days[1].stops.some(stop=>stop.id===visits[direction.id]));
      assert.ok(plan.days[1].stops.some(stop=>stop.from==='Владимир' && stop.to===direction.centres[1]));
      const allVisits = plan.days.flatMap(day=>day.stops).filter(stop=>stop.type==='visit');
      assert.equal(new Set(allVisits.map(stop=>stop.id)).size,allVisits.length);
      for (const day of plan.days) {
        for (const [index,stop] of day.stops.entries()) {
          if (stop.id) assert.ok(map.places[stop.id]?.coordinates);
          assert.ok(stop.start<stop.end);
          assert.ok(index===0 || day.stops[index-1].end<=stop.start);
        }
      }
      assert.ok(routeAlternatives(places,settings).length>=2);
      assert.equal(reviewRoute(places,plan).feasible,true);
    }
  }
});

test('uses published conditions without treating availability as confirmed',()=>{
  const real = routeSettings({...defaultRoute,direction:'gus',theme:'craft',market:'ru',size:8,date:'2026-11-22',demo:false});
  const museum = places.find(place=>place.id==='maltsov-crystal');
  assert.deepEqual(publishedHours(museum,real.date,1).windows,[]);
  assert.equal(assess(museum,real,1).status,'blocked');
  const closed = planRoute(places,real);
  assert.ok(closed.issues.some(({id,day,status})=>id===museum.id && day===1 && status==='blocked'));
  assert.deepEqual(routeAlternatives(places,{...real,date:'2026-11-23'}),[]);
  assert.equal(assess(museum,{...real,date:'2026-11-23'},1).status,'unknown');
  const trail = routeSettings({...defaultRoute,direction:'bogolyubovo',theme:'hike',market:'ru',size:8,date:'2026-12-12'});
  const winter = planRoute(places,trail);
  assert.equal(winter.completeness,false);
  assert.ok(winter.issues.some(({id,status})=>id==='nerl-trail' && status==='blocked'));
  assert.deepEqual(routeAlternatives(places,trail),[]);
});
