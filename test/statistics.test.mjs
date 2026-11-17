import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { metricInfo, months, region, statSummary } from '../engine.mjs';

test('methodology changes preserve the rows but suppress pooled seasonality and year-over-year rates',()=>{
  for (const metric of ['people','nights']) {
    const series = {metric,years:[2024,2025,2026].map((year,index)=>({year,monthly:Array(12).fill(100+index*20),total:1200+index*240}))};
    const same = statSummary(series,[2024,2025]);
    assert.equal(same.mixedMethodology,false);
    assert.equal(same.lows[0].value,110);
    assert.ok(Math.abs(same.yoy-20)<0.001);
    const mixed = statSummary(series,[2025,2026]);
    assert.deepEqual(mixed.years.map(row=>[row.year,row.monthly[0]]),[[2025,120],[2026,140]]);
    assert.equal(mixed.mixedMethodology,true);
    assert.match(mixed.methodologyChange.source,/met168-08042026\.pdf$/u);
    assert.ok(mixed.averages.every(row=>row.value===null));
    assert.deepEqual(mixed.lows,[]);
    assert.equal(mixed.yoy,null);
    const revised = statSummary(series,[2026]);
    assert.equal(revised.mixedMethodology,false);
    assert.equal(revised.lows[0].value,140);
  }
});

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
  const postQuestion = (url,question)=>new Promise((resolve,reject)=>{
    const input = Object.assign(Readable.from([JSON.stringify({question})]),{method:'POST',url});
    handleRequest(input,{writeHead(code){assert.equal(code,200);},end(body){resolve(JSON.parse(body));}}).catch(reject);
  });
  const ask = question=>postQuestion('/api/ask',question);

  const question = 'Проанализируй сезонность туризма во Владимирской области за последние три года и выдели периоды с наименьшими показателями размещения туристов';
  const knowledge = await postQuestion('/api/knowledge',question);
  assert.equal(knowledge.status,'answered');
  assert.match(knowledge.title,/Численность размещённых лиц/u);
  assert.match(knowledge.text,/2023, 2024, 2025/);
  assert.equal(knowledge.sources[0].url,'https://roschart.ru/dataset/'+currentID);
  assert.deepEqual(knowledge.items.map(({title,text})=>[title,text.replace(/\s+/gu,' ')]),[
    ['январь','1 020 чел.'],['февраль','1 070 чел.'],['март','1 120 чел.'],
  ]);

  const result = await ask(question);
  assert.equal(result.plan.metric,'people');
  assert.equal(result.sourceStatus,'live');
  assert.equal(result.summary.edition,'SR_mes_sub_'+edition);
  assert.deepEqual(result.summary.years.map(item=>item.year),[2023,2024,2025]);
  assert.deepEqual(result.summary.lows.map(({month,value})=>[month,value]),[['январь',1020],['февраль',1070],['март',1120]]);
  assert.equal(requests,2);
  const mixed = await ask('Численность размещённых лиц за 2025–2026');
  assert.match(mixed.text,/разной методикой не рассчитаны/);
  assert.equal(mixed.summary.yoy,null);
  assert.deepEqual(mixed.summary.lows,[]);
  assert.equal(mixed.summary.years.at(-1).monthly[11],null);
  const comparePeople = await postQuestion('/api/knowledge','Сравни численность размещённых лиц в январе 2025 и 2026 во Владимирской области.');
  assert.equal(comparePeople.status,'answered');
  assert.match(comparePeople.text,/общее среднее и темп изменения не рассчитаны/);
  assert.ok(comparePeople.sources.some(source=>source.url===mixed.summary.methodologyChange.source));
  assert.deepEqual(comparePeople.items.map(({title,text})=>[title,text.replace(/\s+/gu,' ')]),[['2025 · январь','1 040 чел.'],['2026 · январь','1 060 чел.']]);
  const combinedSeasonality = await postQuestion('/api/knowledge','Сезонность размещения туристов во Владимирской области за 2025–2026 годы.');
  assert.equal(combinedSeasonality.status,'needs-context');
  assert.match(combinedSeasonality.text,/период с одной методикой/);
  assert.deepEqual(combinedSeasonality.items,[]);
  assert.equal(requests,2);
  assert.match((await ask('Какова загрузка гостиниц?')).text,/Для расчёта загрузки нужен фонд/);
  assert.match((await ask('Сезонность в Суздале')).text,/Статистики для отдельного города/);
  assert.equal(requests,2);
  const offline = await ask('Минимум ночёвок по Владимирской области за три года');
  assert.equal(offline.sourceStatus,'error');
  assert.ok(offline.summary.lows.length);
  const explicitNights = await postQuestion('/api/knowledge','Выдели минимум ночёвок при размещении туристов во Владимирской области.');
  assert.match(explicitNights.title,/Число ночёвок/u);
  assert.ok(explicitNights.items.length && explicitNights.items.every(({text})=>text.endsWith('ночёвок')));
  const compareNights = await postQuestion('/api/knowledge','Сравни число ночёвок в январе 2025 и 2026 во Владимирской области.');
  assert.equal(compareNights.status,'answered');
  assert.match(compareNights.text,/последняя копия/u);
  assert.deepEqual(compareNights.items.map(({title})=>title),['2025 · январь','2026 · январь']);
});
