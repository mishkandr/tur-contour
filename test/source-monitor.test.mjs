import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSourceMonitor } from '../source-monitor.mjs';

test('source checks validate the connector, coalesce requests and retain failures across restart',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'tur-source-monitor-'));
  t.after(()=>rm(dir,{force:true,recursive:true}));
  const calls=[];
  let now=Date.parse('2026-11-18T12:00:00Z');
  const fetchImpl=async (url,request)=>{
    const address=new URL(url);
    calls.push(address.href);
    assert.equal(request.redirect,'error');
    if (address.host==='api.open-meteo.com') return new Response(null,{status:429});
    return Response.json({query:{general:{sitename:'Wikipedia'}}});
  };
  const config={fetchImpl,now:()=>now};
  const monitor=createSourceMonitor(dir,config);
  const initial=await monitor.status();
  assert.deepEqual(initial.latest,{});
  assert.deepEqual(initial.errors,[]);
  assert.ok(!initial.providers.includes('openstreetmap-europe'));
  await assert.rejects(monitor.check('https://example.org'),{status:400});
  await Promise.all([monitor.check('weather'),monitor.check('weather')]);
  const current=await monitor.check('wikipedia');
  assert.equal(calls.length,2);
  assert.match(calls[0],/^https:\/\/api.open-meteo.com/);
  assert.equal(current.latest.wikipedia.status,'ok');
  assert.equal(current.latest.weather.detail,'HTTP 429');
  const restarted=createSourceMonitor(dir,config);
  assert.deepEqual(await restarted.status(),current);
  await restarted.check('weather');
  assert.equal(calls.length,2);
  now+=60_000;
  await restarted.check('weather');
  assert.equal(calls.length,3);
  const withEurope=createSourceMonitor(dir,{...config,overpassEuropeUrl:'https://europe.example/api/interpreter',
    fetchImpl:async url=>{
      assert.equal(String(url),'https://europe.example/api/status');
      return new Response('Connected as: 7');
    }});
  const europe=await withEurope.check('openstreetmap-europe');
  assert.ok(europe.providers.includes('openstreetmap-europe'));
  assert.equal(europe.latest['openstreetmap-europe'].status,'ok');
});

test('catalog loads stay separate from connection checks and appear in the persistent error log',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'tur-catalog-journal-'));
  t.after(()=>rm(dir,{force:true,recursive:true}));
  const journal=join(dir,'source-checks.json');
  const legacyProbe={id:'openstreetmap',status:'ok',detail:null,checkedAt:'2026-11-18T12:00:00Z',durationMs:75};
  await writeFile(journal,JSON.stringify([legacyProbe]));
  let calls=0;
  const config={now:()=>Date.parse('2026-11-18T12:01:30Z'),fetchImpl:async()=>{
    calls++;
    return new Response('Connected as: 74');
  }};
  const monitor=createSourceMonitor(dir,config);
  await monitor.recordCatalog({id:'openstreetmap',detail:'timeout',count:null,durationMs:7000,query:'private'});
  const fresh=await monitor.check('openstreetmap');
  assert.equal(calls,1);
  assert.equal(fresh.latest.openstreetmap.status,'ok');
  assert.equal(fresh.latest.openstreetmap.operation,'probe');
  assert.equal(fresh.loads.openstreetmap.status,'error');
  assert.equal(fresh.loads.openstreetmap.checkedAt,fresh.latest.openstreetmap.checkedAt);
  assert.equal(fresh.errors[0].operation,'catalog');
  assert.equal(fresh.errors[0].detail,'timeout');
  await monitor.recordCatalog({id:'wikipedia',count:0,durationMs:105});
  const saved=await createSourceMonitor(dir,config).status();
  assert.equal(saved.loads.wikipedia.status,'empty');
  assert.equal(saved.loads.wikipedia.count,0);
  assert.equal(saved.errors.length,1);
  await monitor.recordCatalog({id:'wikipedia',count:60,durationMs:849.4});
  const loaded=await monitor.status();
  assert.deepEqual(loaded.loads.wikipedia,{id:'wikipedia',operation:'catalog',status:'ok',detail:null,
    checkedAt:'2026-11-18T12:01:30.000Z',durationMs:849,count:60});
  assert.ok(!(await readFile(journal,'utf8')).includes('private'));
});
