import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { metricInfo, months, region } from '../engine.mjs';

test('the case question discovers a monthly release and explains which years are comparable', async t=>{
  const folder = await mkdtemp(join(tmpdir(),'tur-contour-stat-'));
  const actualFetch = globalThis.fetch;
  const actualEnv = {...process.env};
  const edition = '10-2026';
  const currentID = 'sr-mes-sub-'+edition+'-'+metricInfo.people.key;
  const periods = ['2023','2024','2025','2026'];
  const expectedMonths = months.map((_,month)=>1000+month*50);
  let requests = 0;
  process.env.TUR_STATE_DIR = folder;
  process.env.TUR_NO_LLM = '1';
  delete process.env.TUR_ROSSTAT_EDITION;
  globalThis.fetch = async url=>{
    requests++;
    const query = new URL(url);
    if (query.pathname==='/api/catalog' && query.searchParams.get('q').includes('лиц')) {
      return Response.json({ok:true,items:[
        {ds_id:'sr-god-sub-2026-'+metricInfo.people.key,workbook:'SR_god_sub_2026'},
        {ds_id:'sr-mes-sub-09-2026-'+metricInfo.people.key,workbook:'SR_mes_sub_09-2026'},
        {ds_id:currentID,workbook:'SR_mes_sub_'+edition},
      ]});
    }
    if (query.pathname==='/api/dataset/'+currentID && query.searchParams.get('q')===region) {
      const series = months.map((name,index)=>({row:region,col:index ? 'январь-'+name : name,
        values:periods.map((year,yearIndex)=>year==='2026' && index>8 ? null :
          expectedMonths.slice(0,index+1).reduce((sum,month)=>sum+month+yearIndex*20,0))}));
      return Response.json({ok:true,dataset:{workbook:'SR_mes_sub_'+edition,periods,series,
        source_url:'https://roschart.ru/dataset/'+currentID}});
    }
    throw new Error('Источник недоступен в тесте');
  };
  t.after(async()=>{
    globalThis.fetch=actualFetch;
    process.env=actualEnv;
    await rm(folder,{recursive:true,force:true});
  });
  const {handleRequest} = await import('../server.mjs');
  const ask = question=>new Promise((resolve,reject)=>{
    const input = Object.assign(Readable.from([JSON.stringify({question})]),{method:'POST',url:'/api/ask'});
    handleRequest(input,{writeHead(code){assert.equal(code,200);},end(body){resolve(JSON.parse(body));}}).catch(reject);
  });

  const result = await ask('Проанализируй сезонность туризма во Владимирской области за последние три года и выдели периоды с наименьшими показателями размещения туристов');
  assert.equal(result.plan.metric,'people');
  assert.equal(result.sourceStatus,'live');
  assert.equal(result.summary.edition,'SR_mes_sub_'+edition);
  assert.deepEqual(result.summary.years.map(item=>item.year),[2023,2024,2025]);
  assert.deepEqual(result.summary.lows.map(({month,value})=>[month,value]),[['январь',1020],['февраль',1070],['март',1120]]);
  assert.equal(requests,2);
  const mixed = await ask('Численность размещённых лиц за 2025–2026');
  assert.match(mixed.text,/В средние вошли только полные годы/);
  assert.equal(mixed.summary.years.at(-1).monthly[11],null);
  assert.equal(requests,2);
  assert.match((await ask('Какова загрузка гостиниц?')).text,/Для расчёта загрузки нужен фонд/);
  assert.match((await ask('Сезонность в Суздале')).text,/Статистики для отдельного города/);
  assert.equal(requests,2);
  const offline = await ask('Минимум ночёвок по Владимирской области за три года');
  assert.equal(offline.sourceStatus,'error');
  assert.ok(offline.summary.lows.length);
});
