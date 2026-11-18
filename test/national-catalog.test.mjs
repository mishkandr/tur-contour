import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { listCities } from '../nationwide.mjs';

const exec=promisify(execFile);
const hour=3_600_000;
const moduleUrl=new URL('../nationwide.mjs',import.meta.url).href;
const privateBrief='Проверка не сохраняет эту пользовательскую формулировку';
const fixture=`
  import { draftItinerary } from ${JSON.stringify(moduleUrl)};
  const [mode,now,cityId,latitude,longitude]=process.argv.slice(1);
  const [lat,lon]=[Number(latitude),Number(longitude)];
  Date.now=()=>Number(now);
  const calls=[];
  const osm=(id,name,offset,tags)=>({type:'node',id,lat:lat+offset,lon,tags:{name,...tags}});
  const archived=[
    osm(8240,'Музей одного источника',.001,{tourism:'museum'}),
    osm(8241,'Общий городской музей',.002,{tourism:'museum'}),
  ];
  const refreshed=[archived[1],osm(8242,'Новый городской парк',.003,{leisure:'park'})];
  const wiki=[
    {pageid:5901,title:'Общий городской музей',lat:lat+.002,lon},
    {pageid:5902,title:'Парк независимого источника',lat:lat+.004,lon},
  ];
  globalThis.fetch=async url=>{
    calls.push(url.hostname);
    if (url.hostname.endsWith('wikipedia.org') && mode==='wiki') {
      return Response.json({query:{geosearch:wiki}});
    }
    if (!url.hostname.endsWith('wikipedia.org') && ['initial','refresh'].includes(mode)) {
      return Response.json({elements:mode==='initial' ? archived : refreshed,
        osm3s:{timestamp_osm_base:'2026-11-15T10:00:00Z'}});
    }
    return new Response(null,{status:503});
  };
  const input={cityId,days:2,date:'2026-11-28',size:8,required:[${JSON.stringify(privateBrief)}],
    ...(mode==='refresh' ? {requiredPlaceIds:['ruwiki-5901']} : {})};
  if (mode==='busy') {
    await draftItinerary({...input,cityId:'524901'});
    calls.length=0;
  }
  const {source,places,geodata,plan}=await draftItinerary(input);
  process.stdout.write(JSON.stringify({source,calls,places:places.map(({id,name,sources,status})=>({id,name,sources,status})),
    attribution:geodata.attribution,required:plan.required}));
`;

test('provider catalogs survive restarts, merge with fresh sources and expire without storing a brief',async t=>{
  const stateDir=await mkdtemp(join(tmpdir(),'tur-national-catalog-'));
  t.after(()=>rm(stateDir,{recursive:true,force:true}));
  const {cities:[city]}=await listCities('Скопин');
  const start=Date.now();
  async function run(mode,elapsedHours) {
    const {stdout}=await exec(process.execPath,['--input-type=module','-e',fixture,mode,
      String(start+elapsedHours*hour),city.id,...city.coordinates.map(String)],
    {env:{...process.env,TUR_STATE_DIR:stateDir,TUR_NO_OVERPASS:'0',TUR_OVERPASS_URL:'https://osm.example.test'}});
    return JSON.parse(stdout);
  }

  const initial=await run('initial',0);
  assert.equal(initial.source.status,'live');
  assert.deepEqual(initial.calls,['osm.example.test']);
  assert.equal(initial.places.find(place=>place.id==='osm-node-8240')?.status,'unknown');

  const restarted=await run('offline',1);
  assert.equal(restarted.source.reason,'recent');
  assert.equal(restarted.source.status,'snapshot');
  assert.equal(restarted.source.checkedAt,initial.source.checkedAt);
  assert.equal(restarted.source.fetchedAt,new Date(start).toISOString());
  assert.deepEqual(restarted.calls,[]);
  assert.deepEqual(restarted.places,initial.places);

  const busy=await run('busy',19);
  assert.equal(busy.source.reason,'busy');
  assert.deepEqual(busy.calls,[]);
  assert.deepEqual(busy.places,initial.places);

  const withWiki=await run('wiki',20);
  assert.equal(withWiki.source.id,'wikimedia');
  assert.equal(withWiki.source.status,'live');
  assert.deepEqual(withWiki.calls,['osm.example.test','ru.wikipedia.org']);
  assert.deepEqual(withWiki.source.retained.map(({id,status})=>[id,status]),[['openstreetmap','snapshot']]);
  assert.ok(withWiki.places.some(place=>place.id==='osm-node-8240'));
  const duplicates=withWiki.places.filter(place=>place.name==='Общий городской музей');
  assert.equal(duplicates.length,1);
  assert.deepEqual(duplicates[0].sources,['https://ru.wikipedia.org/?curid=5901','https://www.openstreetmap.org/node/8241']);

  const refreshed=await run('refresh',39);
  assert.equal(refreshed.source.id,'openstreetmap');
  assert.ok(refreshed.places.some(place=>place.id==='osm-node-8242'));
  assert.ok(refreshed.places.some(place=>place.id==='ruwiki-5902'));
  assert.ok(!refreshed.places.some(place=>place.id==='osm-node-8240'));
  assert.ok(refreshed.attribution.some(item=>item.label==='Википедия'));
  const pin=refreshed.required.find(place=>place.requestedId==='ruwiki-5901');
  assert.equal(pin?.matched.id,'osm-node-8241');
  assert.equal(pin?.scheduled,true);

  const directory=join(stateDir,'national-catalog');
  const files=(await readdir(directory)).sort();
  assert.deepEqual(files,[city.id+'-openstreetmap.json',city.id+'-wikimedia.json']);
  for (const file of files) {
    const contents=await readFile(join(directory,file),'utf8');
    assert.ok(!contents.includes(privateBrief));
    assert.deepEqual(Object.keys(JSON.parse(contents)).sort(),['checkedAt','fetchedAt','places','version']);
  }

  const stale=await run('offline',60);
  assert.equal(stale.source.reason,'provider-error');
  assert.equal(stale.source.status,'snapshot');
  assert.deepEqual(stale.calls,['osm.example.test','ru.wikipedia.org']);
  assert.deepEqual(stale.places,refreshed.places);

  const expired=await run('offline',35*24);
  assert.equal(expired.source.status,'unavailable');
  assert.ok(!expired.places.some(place=>/824[0-2]|590[12]$/.test(place.id)));
});
