import assert from 'node:assert/strict';
import test from 'node:test';
import { createBriefInterpreter, interpretBrief, parseBrief, warmBriefModel } from '../planner-brief.mjs';

const reference = '2026-11-17';

test('requires an explicitly named place without quotes and recognizes food tours across languages',()=>{
  for (const [input,place] of [
    ['Гастротур по Казани. Обязательно Музей чак-чака.', 'Музей чак-чака'],
    ['Food tour in Kazan. Must visit the Chak-Chak Museum, at a relaxed pace.', 'Chak-Chak Museum'],
    ['喀山美食之旅，必须参观恰克恰克博物馆，8人。', '恰克恰克博物馆'],
  ]) {
    const parsed=parseBrief(input,reference);
    assert.ok(parsed.interests.includes('gastro'));
    assert.deepEqual(parsed.required,[place]);
  }
  assert.deepEqual(parseBrief('Казань. Не обязательно Музей чак-чака. Без «Эрмитажа».',reference).required,[]);
  assert.deepEqual(parseBrief('Казань, обязательно музей чак-чака. Обязательно до обеда.',reference).required,['музей чак-чака']);
});

test('extracts the user date, group, interests, required places and visit deadline between other numbers', () => {
  const result = parseBrief('Казань для 12 человек на три дня с 21 ноября. Музеи и пешие прогулки, только до обеда. Обязательно «Казанский кремль».',reference);
  assert.equal(result.days,3);
  assert.equal(result.size,12);
  assert.equal(result.date,'2026-11-21');
  assert.equal(result.visitDeadline,'12:00');
  assert.deepEqual(result.interests,['museum','hike']);
  assert.deepEqual(result.required,['Казанский кремль']);
});

test('reads English and Simplified Chinese without creating parameters the user omitted', async () => {
  const en = parseBrief('November 21, 2026: three days for twelve people, museums. Walking only.',reference);
  assert.equal(en.date,'2026-11-21');
  assert.equal(en.transport,'walking');
  const {parsed,mode} = await interpretBrief('喀山11月21日，三天，12人，需要博物馆和无障碍通行。',{referenceDate:reference});
  assert.equal(parsed.date,'2026-11-21');
  assert.equal(parsed.days,3);
  assert.equal(parsed.size,12);
  assert.equal(parsed.access,true);
  assert.equal(parsed.market,null);
  assert.equal(mode,'rules');
});

test('AI may classify interests, while operating constraints require explicit input',async t=>{
  t.mock.method(globalThis,'fetch',async()=>Response.json({
    message:{content:JSON.stringify({i:['craft'],r:[],t:'car',p:'dense',m:'zh',a:true})},
  }));
  const {parsed,mode}=await interpretBrief('Казань. Показать, как люди расписывают глиняную посуду.',
    {baseUrl:'http://model.test',model:'test-model',referenceDate:reference});
  assert.equal(mode,'ai');
  assert.deepEqual(parsed.interests,['craft']);
  for (const field of ['transport','pace','market','access']) assert.equal(parsed[field],null);
  assert.equal(parseBrief('Казань, нужна еда из Китая.',reference).market,null);
  for (const input of ['Казань для группы из Китая.','Казань, нужен китайскоязычный гид.','Kazan for travelers from China.','喀山需要中文导游。']) {
    assert.equal(parseBrief(input,reference).market,'zh');
  }
});

test('reuses successful model output without caching dates or aborting another reader',async()=>{
  let calls=0;
  let complete;
  const response=new Promise(resolve=>{complete=resolve;});
  const interpret=createBriefInterpreter({baseUrl:'http://model.test',model:'test-model',fetchImpl:async(_url,request)=>{
    calls+=1;
    assert.equal(JSON.parse(request.body).model,'test-model');
    const answer=await response;
    assert.equal(request.signal.aborted,false);
    return answer;
  }});
  const brief='Казань завтра на два дня. Посмотреть, как расписывают глину.';
  const controller=new AbortController();
  const cancelled=interpret(brief,{signal:controller.signal,referenceDate:reference});
  const shared=interpret(brief,{referenceDate:reference});
  controller.abort();
  assert.equal((await cancelled).mode,'fallback');
  complete(Response.json({message:{content:'{"i":["craft"],"r":[]}'},done_reason:'stop',load_duration:2_500_000_000}));
  const modelResponse=await shared;
  assert.deepEqual(modelResponse.parsed.interests,['craft']);
  assert.equal(modelResponse.timings.model_load,2500);
  const cached=await interpret(brief,{referenceDate:'2026-11-18'});
  assert.equal(cached.cached,true);
  assert.equal(cached.parsed.date,'2026-11-19');
  assert.deepEqual(cached.parsed.interests,modelResponse.parsed.interests);
  assert.equal(calls,1);
});

test('model cancellations and incomplete output do not enter the reusable cache',async()=>{
  let calls=0;
  const interpret=createBriefInterpreter({baseUrl:'http://model.test',model:'test-model',fetchImpl:(_url,{signal})=>{
    calls+=1;
    if (calls===1) return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    return Response.json({message:{content:'{"i":[],"r":[]}'},done_reason:calls===2?'length':'stop'});
  }});
  const brief='Владивосток на два дня.';
  const controller=new AbortController();
  const cancelled=interpret(brief,{signal:controller.signal});
  await Promise.resolve();
  controller.abort();
  assert.equal((await cancelled).mode,'fallback');
  assert.equal((await interpret(brief)).mode,'fallback');
  assert.equal((await interpret(brief)).mode,'ai');
  assert.equal((await interpret(brief)).cached,true);
  assert.equal(calls,3);
});

test('optional preload uses the same model, keep-alive and runtime settings as inference',async()=>{
  const model='test-model';
  const requests=[];
  const fetchImpl=async(url,{body})=>{
    requests.push([url,JSON.parse(body)]);
    return Response.json({message:{content:'{"i":[],"r":[]}'},done_reason:'stop'});
  };
  const baseUrl='http://model.test';
  const keepAlive='10m';
  assert.equal(await warmBriefModel({baseUrl,model,fetchImpl,keepAlive}),true);
  const interpret=createBriefInterpreter({baseUrl,model,fetchImpl,keepAlive});
  await interpret('Петербург на два дня.');
  await interpretBrief('Казань на два дня.',{baseUrl,model,fetchImpl});
  const [[warmUrl,warm],[inferUrl,infer],[,defaults]]=requests;
  assert.equal(warmUrl,baseUrl+'/api/generate');
  assert.equal(inferUrl,baseUrl+'/api/chat');
  assert.equal(warm.prompt,'');
  assert.equal(warm.model,infer.model);
  assert.equal(warm.keep_alive,keepAlive);
  assert.equal(infer.keep_alive,keepAlive);
  assert.equal(defaults.keep_alive,'2m');
  assert.deepEqual(warm.options,infer.options);
});

test('never converts a no-museums instruction into a positive museum preference', () => {
  const parsed = parseBrief('Казань, семейная программа с парками, без музеев.',reference);
  assert.deepEqual(parsed.excludedInterests,['museum']);
  assert.deepEqual(parsed.interests,['family','nature']);
});

test('treats a relaxed pace separately from walking or hiking', () => {
  const parsed = parseBrief('Неспешный маршрут с музеями и на автобусе.',reference);
  assert.deepEqual(parsed.interests,['museum']);
  assert.equal(parsed.pace,'relaxed');
  assert.equal(parsed.transport,'car');
});

test('reports an unsupported spelled-out duration in every interface language', () => {
  for (const request of ['Казань на четыре дня','Four days in Kazan','喀山四天']) {
    assert.equal(parseBrief(request,reference).requestedDays,4);
    assert.equal(parseBrief(request,reference).days,null);
  }
});

test('keeps relative dates, inflected group sizes and explicit negations in three languages', () => {
  for (const [brief, size] of [
    ['Казань завтра на три дня для восемнадцати гостей, без экскурсий по музеям. Не нужен безбарьерный доступ.',18],
    ['Two days in Yekaterinburg from tomorrow for twenty-one guests. No visits to museums, no need for wheelchair access.',21],
    ['符拉迪沃斯托克两天，明天出发，二十四人，不去博物馆。无需轮椅。',24],
  ]) {
    const result = parseBrief(brief,reference);
    assert.equal(result.date,'2026-11-18');
    assert.equal(result.size,size);
    assert.equal(result.access,false);
    assert.deepEqual(result.interests,[]);
    assert.deepEqual(result.excludedInterests,['museum']);
  }
  assert.equal(parseBrief('Для восьми гостей на 21.11.26, требуется вход без ступенек.',reference).access,true);
  assert.equal(parseBrief('November 21 for eight guests.',reference).size,8);
  assert.equal(parseBrief('On 11/21/2026 for three days.',reference).date,'2026-11-21');
  assert.equal(parseBrief('Безбарьерный доступ не требуется.',reference).access,false);
  assert.equal(parseBrief('Wheelchair access is not required.',reference).access,false);
});

test('explicit invalid dates and out-of-range group sizes never become defaults', () => {
  for (const [brief, size] of [
    ['Казань, 3 дня для 120 человек, 31 ноября 2026.', '120'],
    ['Start on 2026-11-31 in Kazan for 0 guests.', '0'],
    ['莫斯科2026年11月31日，一百二十人，三天。','120'],
  ]) {
    const result=parseBrief(brief,reference);
    assert.equal(result.date,null);
    assert.equal(result.invalidDate,'2026-11-31');
    assert.equal(result.size,null);
    assert.equal(result.invalidSize,size);
  }
  assert.equal(parseBrief('Казань завершить к 17.30.',reference).invalidDate,null);
  assert.equal(parseBrief('Москва 2026-11-21, 100 человек.',reference).size,100);
  assert.equal(parseBrief('Москва для 12,5 человек.',reference).invalidSize,'12.5');
  assert.equal(parseBrief('Казань, 3 дня для ста двадцати гостей',reference).invalidSize,'120');
  assert.equal(parseBrief('Three days for one hundred and twenty guests in Kazan.',reference).invalidSize,'120');
});
