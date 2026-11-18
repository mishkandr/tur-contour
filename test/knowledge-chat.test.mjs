import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { defaultRoute, impacts, objectsFrom, statSummary } from '../engine.mjs';
import { answerKnowledge, classifyKnowledge } from '../knowledge-chat.mjs';
import { mergePublishedConditions } from '../published-conditions.mjs';

const load = name => readFile(new URL('../data/'+name+'.json',import.meta.url),'utf8').then(JSON.parse);
const [catalog,snapshot,baseline,audit,vladimir,suzdal,hospitality,regional] = await Promise.all(
  ['catalog','snapshot','demo-audit','demo-audit-change','published-vladimir','published-suzdal','published-hospitality','published-regional'].map(load),
);
const state = {...snapshot,audit,publishedConditions:mergePublishedConditions(catalog,[vladimir,suzdal,hospitality,regional])};
const checkedAt = '2026-11-17T17:00:00Z';
const dashboard = {
  places:objectsFrom(catalog,state),affected:impacts(catalog,state,baseline,snapshot.wiki),auditVersion:'2',auditCheckedAt:checkedAt,
  changes:[{id:'suzdal-kremlin',name:'Суздальский кремль',field:'Лимит группы',before:25,after:12,demo:true,
    source:'Учебный аудит',url:'/api/audit-version/2',at:checkedAt}],
  people:statSummary(snapshot.stats.people,[]),nights:statSummary(snapshot.stats.nights,[]),
  sources:{nights:{status:'error',checkedAt},wiki:{status:'live',checkedAt}},
};

test('answers an English schedule question from the named venue and date',async()=>{
  const result = await answerKnowledge({question:'Is the Suzdal Kremlin open on 17 November 2026?',locale:'en',dashboard,settings:defaultRoute});
  assert.equal(result.intent,'schedule');
  assert.equal(result.mode,'deterministic');
  assert.match(result.items[0].text,/Closed/);
  assert.match(result.items[1].text,/Территория открыта ежедневно/u);
  assert.ok(result.actions.some(action=>action.href==='#impact?place=suzdal-kremlin'));
  assert.equal(result.sources[0].url,suzdal.objects['suzdal-kremlin'].schedule.url);
  assert.equal(result.sources[0].checkedAt,suzdal.checkedAt);
});

test('uses explicit Chinese dates, displays coverage gaps and rejects impossible dates',async()=>{
  const input = {locale:'zh',dashboard,settings:defaultRoute};
  const answer = await answerKnowledge({...input,question:'马尔佐夫水晶博物馆 2026年11月23日开放吗？'});
  assert.match(answer.items[0].text,/闭馆/);
  assert.equal(answer.title,'马尔佐夫水晶博物馆');
  const future = await answerKnowledge({...input,question:'马尔佐夫水晶博物馆 2027年1月3日开放吗？'});
  assert.match(future.items[0].text,/未涵盖/);
  const invalid = await answerKnowledge({...input,question:'马尔佐夫水晶博物馆 2026年2月31日开放吗？'});
  assert.equal(invalid.status,'needs-context');
});

test('uses statistics facts for the requested month and rejects uncovered topics',async()=>{
  const obtained = [];
  const askStats = async (question,settings,plan)=>{
    obtained.push(plan);
    return {summary:statSummary(snapshot.stats[plan.metric],plan.years),sourceStatus:'error'};
  };
  const result = await answerKnowledge({question:'How many accommodated guests in July 2024?',locale:'en',dashboard},{askStats});
  assert.equal(obtained[0].metric,'people');
  assert.deepEqual(obtained[0].years,[2024]);
  assert.equal(result.items.length,1);
  assert.match(result.items[0].title,/2024 · July/);
  assert.match(result.text,/last available copy/);
  assert.equal(result.sources[0].checkedAt,snapshot.stats.people.checkedAt);
  for (const question of ['Сезонность размещения в Суздале','Какая загрузка гостиниц во Владимирской области?','How many overnight stays in Kazan in 2024?']) {
    const missing = await answerKnowledge({question,dashboard},{askStats});
    assert.equal(missing.status,'unavailable');
    assert.deepEqual(missing.items,[]);
  }
  assert.equal(obtained.length,1);
});

test('marks the synthetic audit change and points to the affected programme',async()=>{
  const change = await answerKnowledge({question:'Как поменялся лимит Суздальского кремля?',dashboard});
  assert.equal(change.intent,'changes');
  assert.match(change.items[0].text,/25 → 12/);
  assert.equal(change.items[0].status,'Учебные данные');
  const impact = await answerKnowledge({question:'Which routes did this change affect?',locale:'en',dashboard});
  assert.equal(impact.intent,'impact');
  assert.equal(impact.items[0].href,'#impact?program=group-cn');
  assert.equal(impact.items[0].status,'Training data');
  assert.equal(impact.sources[0].checkedAt,checkedAt);
  const actual = await answerKnowledge({question:'Какие маршруты затронули реальные изменения?',dashboard});
  assert.deepEqual(actual.items,[]);
});

test('lists the requested kind and location and separates source availability from the last check',async()=>{
  const museum = await answerKnowledge({question:'Какие музеи в Муроме есть в каталоге?',dashboard});
  assert.equal(museum.intent,'places');
  assert.equal(museum.items.length,2);
  assert.ok(museum.items.every(({text})=>text==='Муром'));
  const sources = await answerKnowledge({question:'Какой статус источников?',dashboard});
  assert.equal(sources.intent,'sources');
  assert.match(sources.items[0].text,/последняя копия/u);
  assert.equal(sources.items[0].checkedAt,checkedAt);
  assert.equal(sources.sources[0].checkedAt,snapshot.stats.nights.checkedAt);
});

test('keeps ambiguous queries safe even if optional classification fails',async()=>{
  const unknown = await answerKnowledge({question:'Привет',dashboard},{classify:async()=>{throw new Error('offline');}});
  assert.equal(unknown.status,'needs-context');
  assert.deepEqual(unknown.sources,[]);
  const missing = await answerKnowledge({question:'Когда открыт Кремль?',dashboard});
  assert.equal(missing.status,'needs-context');
  assert.deepEqual(missing.sources,[]);
});

test('uses an optional model only for a known intent and never for answer text',async()=>{
  let request;
  const fetchImpl = async (url,options)=>{
    request=JSON.parse(options.body);
    return {ok:true,json:async()=>({message:{content:'{"intent":"sources","text":"Invented source"}'}})};
  };
  const classify = question=>classifyKnowledge(question,{model:'local-test',baseUrl:'http://localhost:11434',fetchImpl});
  const result = await answerKnowledge({question:'Расскажи о первичной подложке',dashboard},{classify});
  assert.equal(result.intent,'sources');
  assert.equal(result.mode,'classified');
  assert.ok(request.format.properties.intent.enum.includes('sources'));
  assert.doesNotMatch(JSON.stringify(result),/Invented source/);
});

const kazan = {id:'551487',name:'Казань',en:'Kazan',cn:'喀山',sourceUrl:'https://www.geonames.org/551487/'};
const kazanDraft = {
  places:[
    {id:'osm-node-1',name:'Музей города',en:'City Museum',city:kazan.name,kind:'visit',tags:['museum'],
      url:'https://www.openstreetmap.org/node/1',hoursHint:'24/7'},
    {id:'osm-node-2',name:'Музей другого города',city:'Набережные Челны',kind:'visit',tags:['museum'],url:'https://www.openstreetmap.org/node/2'},
    {id:'osm-node-3',name:'Отель',city:kazan.name,kind:'stay',tags:[],url:'https://www.openstreetmap.org/node/3'},
  ],
  source:{name:'OpenStreetMap',url:'https://www.openstreetmap.org/copyright',status:'snapshot',checkedAt},
};

test('returns only sourced candidates in the named nonpilot city and leaves visit availability unconfirmed',async()=>{
  let input;
  const detectCities = async()=>[kazan];
  const lookupDraft = async settings=>{input=settings;return kazanDraft;};
  const result = await answerKnowledge({question:'Which museums are open in Kazan on November 21, 2026 for a group of 11?',locale:'en',dashboard},
    {detectCities,lookupDraft});
  assert.equal(result.intent,'schedule');
  assert.equal(result.status,'unavailable');
  assert.equal(input.cityId,kazan.id);
  assert.equal(input.date,'2026-11-21');
  assert.equal(input.size,11);
  assert.equal(input.demo,false);
  assert.deepEqual(result.items.map(item=>[item.title,item.href]),[['City Museum','https://www.openstreetmap.org/node/1']]);
  assert.match(result.text,/Confirm opening hours/i);
  assert.doesNotMatch(JSON.stringify(result),/24\/7/);
  assert.equal(result.sources[0].title,'Saved snapshot · OpenStreetMap');
  assert.equal(result.sources[0].checkedAt,checkedAt);
});

test('does not substitute unrelated venues or Vladimir statistics for other cities',async()=>{
  let calls=0;
  const lookupDraft = async()=>{calls+=1;return kazanDraft;};
  const detectCities = async()=>[kazan];
  const exact = await answerKnowledge({question:'Работает ли Музей игрушки в Казани?',dashboard},{detectCities,lookupDraft});
  assert.deepEqual(exact.items,[]);
  assert.equal(exact.status,'unavailable');
  const nearby = await answerKnowledge({question:'Какие музеи находятся рядом с Музеем Города в Казани?',dashboard},{detectCities,lookupDraft});
  assert.deepEqual(nearby.items,[]);
  assert.match(nearby.text,/Близость/u);
  const stats = await answerKnowledge({question:'Сезонность размещения в Казани',dashboard},
    {detectCities,lookupDraft,askStats:async()=>{throw new Error('City statistics must not be fetched from the pilot');}});
  assert.deepEqual(stats.items,[]);
  assert.match(stats.text,/Владимирскую область/u);
  assert.equal(calls,1);
});

test('uses the selected city for a short question and links sources from its catalogue',async()=>{
  const {source,...catalog}=kazanDraft;
  const result=await answerKnowledge({question:'Какие музеи есть в каталоге?',city:kazan,dashboard},{
    detectCities:async()=>[],
    lookupDraft:async input=>{
      assert.equal(input.cityId,kazan.id);
      return {...catalog,catalogSources:[{...source,cityId:kazan.id}]};
    },
  });
  assert.equal(result.status,'answered');
  assert.deepEqual(result.items.map(item=>item.title),['Музей города']);
  assert.equal(result.sources[0].url,source.url);
});

test('uses an explicitly selected administrative territory and never borrows Vladimir data if it is unavailable',async()=>{
  const region = {id:'73',name:'Республика Татарстан',en:'Tatarstan Republic'};
  const input = {question:'How many overnight stays in 2025?',locale:'en',dashboard,scope:region.id};
  const getRegionalStats = async plan=>{
    assert.deepEqual([plan.regionId,plan.metric,plan.years],['73','nights',[2025]]);
    return {region,summary:{years:[{year:2025,total:123456}],source:'https://roschart.ru/dataset/case-sample',checkedAt}};
  };
  const supplied = await answerKnowledge(input,{getRegionalStats});
  assert.match(supplied.title,/Tatarstan Republic/);
  assert.equal(supplied.items[0].text,'123,456 overnight stays');
  assert.doesNotMatch(supplied.text,/Vladimir/);
  const missing = await answerKnowledge(input,{getRegionalStats:async()=>({region,summary:null,sourceStatus:'error'})});
  assert.equal(missing.status,'unavailable');
  assert.deepEqual(missing.items,[]);
  const city = await answerKnowledge({...input,question:'How many overnight stays in Kazan in 2025?'},{getRegionalStats,
    detectCities:async()=>[kazan]});
  assert.equal(city.status,'unavailable');
  assert.match(city.text,/municipal series/);
});
