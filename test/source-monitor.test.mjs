import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
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
  assert.deepEqual(await monitor.status(),{latest:{},errors:[]});
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
});
