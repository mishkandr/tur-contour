import assert from 'node:assert/strict';
import test from 'node:test';
import { metricInfo, months } from '../engine.mjs';
import { createRegionalStatistics, regionForCity, statisticsRegions } from '../regional-statistics.mjs';

const monthColumns = months.map((month,index)=>index ? 'январь-'+month : month);
const workbook = 'SR_mes_sub_09-2026';
const id = metric => 'sr-mes-sub-09-2026-'+metricInfo[metric].key;
const source = metric => 'https://roschart.ru/dataset/'+id(metric);
const rows = (name,values) => monthColumns.map((col,index)=>({row:name,col,values:[values[index]]}));
const dataset = (series,periods=['2025'],seriesTotal=series.length) => Response.json({ok:true,
  dataset:{workbook,periods,series,series_total:seriesTotal}});

test('maps the city opt-in to an indexed administrative territory, and rejects city IDs and free text in get',async()=>{
  assert.deepEqual(await regionForCity('551487'),{
    id:'73',name:'Республика Татарстан',en:'Tatarstan Republic',cn:null,scope:'federal-subject',
  });
  assert.equal((await regionForCity('2013348')).name,'Приморский край');
  assert.ok((await statisticsRegions()).some(area=>area.id==='59' && area.scope==='federal-subject'));
  let reads=0;
  const {get} = createRegionalStatistics({fetchImpl:async()=>{reads++;throw new Error('unexpected');}});
  for (const regionId of ['551487','Казань','Москов','../../catalog','constructor','']) {
    await assert.rejects(get({regionId,metric:'nights'}),{status:400});
  }
  assert.equal(reads,0);
});

test('uses one shared monthly release for multiple regions and extracts only exact name matches',async()=>{
  const tatarstan = [243044,450000,660000,949978,1270000,1580000,1950000,2281711,2665000,null,null,null];
  const primorsky = [233137,481360,790880,1118794,1446544,1985000,2531000,3199000,3712000,null,null,null];
  const series = [...rows('Республика Татарстан',tatarstan),...rows('Приморский край',primorsky),...rows('Казань',Array(12).fill(10)),
    ...rows('Приморский край (другая территория)',Array(12).fill(20))];
  let calls=0;
  const {get} = createRegionalStatistics({now:()=>Date.parse('2026-11-17T12:00:00Z'),fetchImpl:async url=>{
    calls++;
    if (url.pathname==='/api/catalog') return Response.json({ok:true,items:[
      {workbook:'SR_mes_sub_07-2026',ds_id:id('people').replace('09-2026','07-2026')},
      {workbook,ds_id:id('people')},
    ]});
    assert.equal(url.pathname,'/api/dataset/'+id('people'));
    assert.equal(url.search,'');
    return dataset(series,['2026']);
  }});
  const [tatar,primor] = await Promise.all([get({regionId:'73',metric:'people',years:[2026]}),get({regionId:'59',metric:'people',years:[2026]})]);
  assert.equal(calls,2);
  assert.equal(tatar.sourceStatus,'live');
  assert.equal(tatar.summary.source,source('people'));
  assert.equal(tatar.summary.geographicScope,'federal-subject');
  assert.equal(tatar.summary.years[0].monthly[0],243044);
  assert.equal(tatar.summary.years[0].total,null);
  assert.equal(primor.summary.region,'Приморский край');
  assert.equal(primor.summary.years[0].monthly[1],248223);
  const missing = await get({regionId:'73',metric:'people',years:[2020]});
  assert.equal(missing.sourceStatus,'unavailable');
  assert.equal(missing.reason,'missing-period');
  const incompatible = await get({regionId:'83',metric:'people',years:[2026]});
  assert.equal(incompatible.reason,'missing-region');
  assert.equal(calls,2);
});

test('handles truncated workbooks with a bound exact query and preserves gaps in cumulative rows',async()=>{
  const fitted = rows('Приморский край',[100,210,null,490,650,910,1300,1700,2000,2300,2550,2800]);
  const requests=[];
  const {get} = createRegionalStatistics({edition:'09-2026',fetchImpl:async url=>{
    requests.push(url);
    if (!url.search) return dataset(rows('Республика Татарстан',Array.from(months,(_,index)=>100*(index+1))),['2025'],120);
    assert.equal(url.searchParams.get('q'),'Приморский край');
    return dataset([...rows('Приморский край (часть)',Array(12).fill(70)),...fitted]);
  }});
  const input={regionId:'59',metric:'nights',years:[2025]};
  const result = await get(input);
  assert.equal(result.summary.source,source('nights'));
  assert.deepEqual(result.summary.years[0].monthly.slice(0,6),[100,110,null,null,160,260]);
  assert.equal(result.summary.years[0].total,null);
  assert.equal((await get(input)).sourceStatus,'cached');
  assert.equal(requests.length,2);
});

test('uses exact workbook names for federal cities and subjects with older names in the city index',async()=>{
  const series=['Московская область','г.Москва (часть)','г.Москва','г. Санкт-Петербург','Нижегородская область']
    .flatMap((region,index)=>rows(region,Array.from(months,(_,month)=>(month+1)*(index+1)*100)));
  const {get}=createRegionalStatistics({edition:'09-2026',fetchImpl:async()=>dataset(series)});
  const info=await Promise.all(['48','66','51'].map(regionId=>get({regionId,metric:'people',years:[2025]})));
  assert.deepEqual(info.map(result=>result.region.name),['Москва','Санкт-Петербург','Нижегородская область']);
  assert.deepEqual(info.map(result=>result.summary.years[0].monthly[0]),[300,400,500]);
});

test('honours provider Retry-After and reports the original date of stale data',async()=>{
  let now=Date.parse('2026-11-17T10:00:00Z');
  let attempts=0;
  const {get} = createRegionalStatistics({edition:'09-2026',now:()=>now,fetchImpl:async()=>{
    attempts++;
    if (attempts>1) return new Response(null,{status:429,headers:{'retry-after':'11200'}});
    return dataset(rows('Республика Татарстан',Array.from(months,(_,index)=>121*(index+1))));
  }});
  const input={regionId:'73',metric:'people'};
  const original = await get(input);
  now+=12*60*60*1000+1;
  const stale = await get(input);
  assert.equal(stale.sourceStatus,'error');
  assert.equal(stale.reason,'rate-limit');
  assert.equal(stale.summary.checkedAt,original.summary.checkedAt);
  assert.equal(stale.retryAt,new Date(now+11200000).toISOString());
  assert.equal((await get({...input,regionId:'59'})).summary,null);
  assert.equal(attempts,2);
});
