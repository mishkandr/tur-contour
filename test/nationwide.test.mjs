import assert from 'node:assert/strict';
import test from 'node:test';
import {detectCities,draftItinerary,listCities} from '../nationwide.mjs';

const offline = async () => { throw new Error('Test connection unavailable'); };
const request = {cityId:'524901',days:2,date:'2026-11-28',size:18,market:'zh',theme:'museum'};

test('countrywide gazetteer finds cities in different languages and regions',async()=>{
  const moscow = await listCities('Москва');
  assert.equal(moscow.source.license,'CC BY 4.0');
  assert.ok(moscow.total>180_000);
  assert.equal(moscow.cities[0].id,'524901');
  assert.equal(moscow.cities[0].cn,'莫斯科');
  assert.equal((await listCities('Vladivostok')).cities[0].id,'2013348');
  assert.equal((await listCities('喀山')).cities[0].id,'551487');
  assert.equal((await listCities('новгород')).cities[0].name,'Нижний Новгород');
  assert.equal((await listCities('Верхоянск')).cities[0].name,'Верхоянск');
  assert.deepEqual((await listCities('Нет Такого Места')).cities,[]);
});

test('free-text city matching keeps whole words, inflections and multiple cities',async()=>{
  const found = await detectCities('Три дня в Нижнем Новгороде, затем по Казани и в Санкт-Петербурге');
  assert.deepEqual(found.map(place=>place.name),['Нижний Новгород','Казань','Санкт-Петербург']);
  assert.equal((await detectCities('Два дня во Владивостоке'))[0].id,'2013348');
  assert.equal((await detectCities('周末去喀山玩两天'))[0].id,'551487');
  assert.deepEqual(await detectCities('Подмосковный парк и петербургский музей'),[]);
});

test('three geographically separate snapshots supply mapped places but leave all visits provisional',async()=>{
  for (const [cityId,requiredName] of [
    ['524901','Красная площадь'],['551487','Казанский кремль'],['2013348','Владивостокская крепость'],
  ]) {
    const result=await draftItinerary({...request,cityId,days:3,required:[requiredName,'Несуществующая экскурсия']},{fetchImpl:offline});
    assert.equal(result.source.status,'snapshot');
    assert.equal(result.plan.days.length,3);
    assert.equal(result.plan.days[2].date,'2026-11-30');
    assert.equal(result.plan.completeness,false);
    assert.deepEqual(result.plan.required.map(item=>item.scheduled),[true,false]);
    const visits=result.plan.days.flatMap(day=>day.stops.filter(stop=>stop.type==='visit'));
    assert.equal(visits.length,new Set(visits.map(stop=>stop.id)).size);
    for (const stop of result.plan.days.flatMap(day=>day.stops)) {
      assert.equal(stop.status,'unknown');
      assert.equal(stop.geoStatus,'mapped');
      assert.ok(result.geodata.places[stop.id]);
      assert.ok(stop.url.startsWith('https://'));
    }
  }
});

test('Overpass requests receive only fixed coordinate queries and the pace and mode constrain the plan',async()=>{
  const endpoints=[];
  const records=Array.from({length:10},(_,i)=>({type:'node',id:100+i,lat:55.7520+i*0.0005,lon:37.6178,
    tags:{name:'Музей '+i,tourism:'museum'}}));
  records.push({type:'node',id:120,lat:55.788,lon:37.6178,tags:{name:'Дальний парк',leisure:'park'}});
  records.push({type:'node',id:121,lat:55.753,lon:37.61765,tags:{name:'Кафе рядом',amenity:'restaurant'}});
  records.push({type:'way',id:122,center:{lat:55.753,lon:37.61765},tags:{name:'Отель рядом',tourism:'hotel'}});
  const fetchImpl = async url=>{
    endpoints.push(String(url));
    return new Response(JSON.stringify({elements:records}),{headers:{'Content-Type':'application/json'}});
  };
  const required=['Дальний парк','Мой секретный текст'];
  const relaxed=await draftItinerary({...request,pace:'relaxed',transport:'walking',required},{fetchImpl});
  const dense=await draftItinerary({...request,pace:'dense',transport:'car',required},{fetchImpl});
  assert.equal(dense.source.status,'live');
  assert.ok(endpoints.every(url=>!decodeURIComponent(url).includes(required[1]) && url.includes('55.75204')));
  assert.equal(relaxed.plan.required[0].scheduled,false);
  assert.equal(relaxed.plan.required[0].reason,'out-of-range');
  assert.equal(dense.plan.required[0].scheduled,true);
  const visits = plan=>plan.days.flatMap(day=>day.stops).filter(stop=>stop.type==='visit');
  assert.ok(visits(dense.plan).length>visits(relaxed.plan).length);
  assert.equal(dense.plan.required[1].scheduled,false);
});

test('known wheelchair-inaccessible venues are excluded when step-free access is required', async()=>{
  const signedOut = {type:'node',id:301,lat:55.752,lon:37.6178,
    tags:{name:'Музей с лестницей',tourism:'museum',wheelchair:'no'}};
  const unverified = {type:'node',id:302,lat:55.7525,lon:37.6181,
    tags:{name:'Музей без сведений о входе',tourism:'museum'}};
  const fetchImpl=async()=>new Response(JSON.stringify({elements:[signedOut,unverified]}));
  const draft=await draftItinerary({...request,access:true,required:['Музей с лестницей','Музей без сведений о входе']},{fetchImpl});
  assert.equal(draft.plan.required[0].accessBlocked,true);
  assert.equal(draft.plan.required[0].scheduled,false);
  assert.equal(draft.plan.required[1].scheduled,true);
  assert.ok(draft.places.every(place=>place.name!=='Музей с лестницей'));
  assert.ok(draft.plan.days.flatMap(day=>day.stops).every(place=>place.status==='unknown'));
});

test('uncovered cities keep explicit gaps and never suggest a historical hotel as lodging',async()=>{
  const {cities}=await listCities('Иркутск');
  const cityId=cities[0].id;
  const missed=await draftItinerary({...request,cityId},{fetchImpl:offline});
  assert.equal(missed.source.status,'unavailable');
  assert.ok(missed.plan.days.every(day=>day.stops.length===0 && day.missing.length>0));
  const fetchImpl=async url=>{
    if (!String(url).includes('wikipedia.org')) throw new Error('Overpass test timeout');
    const [lat,lon]=cities[0].coordinates;
    return new Response(JSON.stringify({query:{geosearch:[
      {pageid:536,title:'Городской музей',lat,lon},{pageid:537,title:'Старая гостиница',lat,lon},
    ]}}));
  };
  const fallback=await draftItinerary({...request,cityId},{fetchImpl});
  assert.equal(fallback.source.id,'wikimedia');
  assert.equal(fallback.places.length,1);
  assert.equal(fallback.places[0].kind,'visit');
  assert.ok(fallback.plan.days[0].missing.some(line=>line.includes('размещение')));
});

test('multi-city drafts visit selected cities in order and leave transfer timing unresolved',async()=>{
  const result=await draftItinerary({...request,days:3,additionalCityIds:['551487','2013348'],
    required:['Казанский кремль','Владивостокская крепость']},{fetchImpl:offline});
  assert.deepEqual(result.locations.map(city=>city.name),['Москва','Казань','Владивосток']);
  assert.equal(result.location.name,'Москва');
  assert.equal(result.sources.length,3);
  assert.deepEqual(result.plan.days.map(day=>day.cityId),['524901','551487','2013348']);
  assert.ok(result.plan.required.every(item=>item.scheduled));
  for (const day of result.plan.days.slice(1)) {
    assert.equal(day.transfer.status,'unknown');
    assert.equal(day.transfer.distanceType,'straight-line');
    assert.ok(day.transfer.distanceKm>500);
    assert.ok(day.missing.some(text=>text.includes('переезд')));
    assert.ok(day.stops.every(stop=>stop.type!=='travel'));
  }
  assert.ok(result.geodata.cities.Владивосток.coordinates[1]>100);
  await assert.rejects(draftItinerary({...request,additionalCityIds:['551487','2013348']},{fetchImpl:offline}),{status:400});
});

test('visit deadlines constrain sightseeing while preserving afternoon services',async()=>{
  const early=await draftItinerary({...request,pace:'dense',visitDeadline:'12:00'},{fetchImpl:offline});
  assert.equal(early.settings.visitDeadline,'12:00');
  for (const day of early.plan.days) {
    assert.ok(day.stops.some(stop=>stop.type==='visit'));
    assert.ok(day.stops.filter(stop=>stop.type==='visit').every(stop=>stop.end<='12:00'));
    assert.ok(day.stops.some(stop=>stop.type==='food' && stop.start>='12:00'));
  }
  assert.ok(early.plan.days[0].stops.some(stop=>stop.type==='stay' && stop.start>='15:00'));
  const tooEarly=await draftItinerary({...request,visitDeadline:'09:00'},{fetchImpl:offline});
  assert.ok(tooEarly.plan.days.every(day=>day.missing.some(note=>note.includes('09:00'))));
  assert.ok(tooEarly.plan.days.every(day=>day.stops.every(stop=>stop.type!=='visit')));
  await assert.rejects(draftItinerary({...request,visitDeadline:'18:20'}),{status:400});
});

test('a tight schedule keeps multiple mandatory visits, a realistic lunch window and same-city overnight continuity',async()=>{
  const city=(await listCities('Тюмень')).cities[0];
  const [lat,lon]=city.coordinates;
  const records=[
    [1,0.003,0.000,{name:'Музей из обязательного списка',tourism:'museum'}],
    [2,0.004,0.001,{name:'Форт из обязательного списка',historic:'fort'}],
    [3,0.003,0.001,{name:'Ещё один музей',tourism:'museum'}],
    [4,0.003,0.0011,{name:'Ресторан А',amenity:'restaurant'}],
    [5,0.003,0.0012,{name:'Ресторан Б',amenity:'restaurant'}],
    [6,0.003,0.0013,{name:'Ресторан В',amenity:'restaurant'}],
    [7,0.003,0.0014,{name:'Отель для группы',tourism:'hotel'}],
    [8,0.003,0.0015,{name:'Ресторан Г',amenity:'restaurant'}],
  ];
  const fetchImpl=async()=>new Response(JSON.stringify({elements:records.map(([id,x,y,tags])=>({
    type:'node',id,lat:lat+x,lon:lon+y,tags,
  }))}));
  const draft=await draftItinerary({...request,cityId:city.id,days:3,pace:'dense',size:24,visitDeadline:'12:00',
    required:['Музей из обязательного списка','Форт из обязательного списка']},{fetchImpl});
  const [first,second]=draft.plan.days;
  assert.ok(draft.plan.required.every(item=>item.scheduled));
  assert.equal(first.stops.filter(stop=>stop.required).length,2);
  assert.equal(first.logistics.overnight.status,'suggested');
  assert.equal(first.logistics.overnight.action,'check-in');
  assert.equal(second.logistics.originStayId,first.logistics.overnight.id);
  assert.equal(second.logistics.overnight.action,'return');
  assert.equal(second.stops[0].leg.fromId,first.logistics.overnight.id);
  assert.equal(second.stops[0].leg.mode,'walking');
  assert.notEqual(first.logistics.lunch.id,second.logistics.lunch.id);
  const proposedLunch=first.stops.find(stop=>stop.type==='food');
  assert.ok(proposedLunch.start>='12:00' && proposedLunch.end<='14:45');
  assert.ok(proposedLunch.alternatives.some(option=>option.status==='unknown' && option.url.startsWith('https://')));
  assert.ok(first.stops.every(stop=>stop.status==='unknown' && stop.leg.estimate==='straight-line'));

  const oneLunch=await draftItinerary({...request,cityId:city.id,days:2,
    omittedIds:['osm-node-5','osm-node-6','osm-node-8']},{fetchImpl});
  assert.equal(oneLunch.plan.days[1].logistics.lunch.id,oneLunch.plan.days[0].logistics.lunch.id);
  assert.equal(oneLunch.plan.days[1].logistics.lunch.repeated,true);
});

test('scoped replacements keep all required visits, exact slots and other days intact',async()=>{
  const city=(await listCities('Тюмень')).cities[0];
  const [lat,lon]=city.coordinates;
  const element=(id,name,x,tags)=>({type:'node',id,lat:lat+x,lon:lon+0.0002,tags:{name,...tags}});
  const required=Array.from({length:5},(_,i)=>'Музей обязательный '+(i+1));
  const nearby=Array.from({length:4},(_,i)=>element(21+i,'Ресторан квартала '+(i+1),0.002+i*0.0001,{amenity:'restaurant'}));
  const elements=[...required.map((name,i)=>element(i+1,name,0.002+i*0.00008,{tourism:'museum'})),
    ...nearby,element(25,'Дальний ресторан',0.048,{amenity:'restaurant'}),
    element(31,'Отель Город',0.0026,{tourism:'hotel'}),element(32,'Отель Парк',0.003,{tourism:'hotel'})];
  const options={fetchImpl:async()=>new Response(JSON.stringify({elements}))};
  const input={...request,cityId:city.id,days:3,required};
  const baseline=await draftItinerary(input,options);
  const [first,second,third]=baseline.plan.days;
  const stop=second.stops.find(stop=>stop.type==='food');
  const alternative=stop.alternatives[0];
  const operation={day:1,fromId:stop.id,toId:alternative.id};
  const result=await draftItinerary({...input,replacements:[operation]},options);
  assert.deepEqual(result.plan.replacements,[{...operation,status:'applied'}]);
  assert.deepEqual(result.plan.required,baseline.plan.required);
  assert.ok(result.plan.required.every(stop=>stop.scheduled));
  const project=day=>day.stops.map(({alternatives,...rest})=>rest);
  assert.deepEqual(project(result.plan.days[0]),project(first));
  assert.deepEqual(project(result.plan.days[2]),project(third));
  const replacedDay=result.plan.days[1];
  const index=second.stops.indexOf(stop);
  assert.equal(replacedDay.stops[index].id,alternative.id);
  assert.equal(replacedDay.stops[index].start,stop.start);
  assert.equal(replacedDay.stops[index].end,stop.end);
  assert.equal(replacedDay.stops[index+1].leg.fromId,alternative.id);
  assert.equal(replacedDay.logistics.lunch.id,alternative.id);
  assert.ok(replacedDay.stops[index].alternatives.some(item=>item.id===stop.id));
  assert.equal(replacedDay.stops[index].status,'unknown');
  const restore={day:1,fromId:alternative.id,toId:stop.id};
  const restored=await draftItinerary({...input,replacements:[operation,restore]},options);
  assert.deepEqual(restored.plan.replacements.map(change=>change.status),['applied','applied']);
  assert.deepEqual(restored.plan.days,baseline.plan.days);

  const protectedStop=second.stops.find(stop=>stop.required);
  const rejected=await draftItinerary({...input,replacements:[
    {...operation,fromId:protectedStop.id},
    {...operation,fromId:second.logistics.overnight.id},
    {...operation,toId:first.logistics.lunch.id},
    {...operation,toId:'osm-node-25'},
    {...operation,toId:'osm-node-999'},
    {...operation,fromId:'osm-node-999'},
  ]},options);
  assert.deepEqual(rejected.plan.replacements.map(change=>change.reason),[
    'mandatory-stop','lodging-continuity','already-used','transfer-conflict','alternative-unavailable','stop-unavailable',
  ]);
  assert.deepEqual(rejected.plan.days,baseline.plan.days);
  await assert.rejects(draftItinerary({...input,replacements:[{...operation,toId:operation.fromId}]},options),{status:400});
});

test('an outdoor stop offers an indoor same-time candidate for checking before a trip',async()=>{
  const city=(await listCities('Тюмень')).cities[0];
  const [lat,lon]=city.coordinates;
  const place=(id,name,tags)=>({type:'node',id,lat,lon:lon+id*0.00001,tags:{name,...tags}});
  const parks=Array.from({length:12},(_,index)=>place(index+1,`Сквер ${index+1}`,{leisure:'park'}));
  const elements=[...parks,place(40,'Выставочный зал',{tourism:'gallery',indoor:'yes'}),
    place(41,'Ресторан',{amenity:'restaurant'}),place(42,'Гостиница',{tourism:'hotel'})];
  const result=await draftItinerary({...request,cityId:city.id,theme:'nature'},{fetchImpl:async()=>Response.json({elements})});
  const outdoor=result.plan.days.flatMap(day=>day.stops).filter(stop=>stop.exposure==='outdoors');
  assert.ok(outdoor.length);
  assert.ok(outdoor.some(stop=>stop.alternatives.some(candidate=>candidate.id==='osm-node-40' &&
    candidate.exposure==='indoors' && candidate.status==='unknown')));
});

test('a relaxed Kazan plan uses the morning while keeping mandatory visits and group lunch',async()=>{
  const {plan}=await draftItinerary({...request,cityId:'551487',date:'2026-11-21',days:3,size:12,market:'ru',
    pace:'relaxed',interests:['heritage','museum'],required:['Казанский кремль']},{fetchImpl:offline});
  const [morning,lunch]=plan.days[0].stops;
  assert.equal(morning.type,'visit');
  assert.equal(morning.required,true);
  assert.ok(morning.start<'12:00');
  assert.equal(lunch.type,'food');
  assert.ok(lunch.start>='12:00' && lunch.end<='14:45');
  assert.equal(plan.required[0].scheduled,true);
});

test('similarly named venues require a choice and out-of-range lunch remains a gap',async()=>{
  const city=(await listCities('Тюмень')).cities[0];
  const [lat,lon]=city.coordinates;
  const elements=[
    {type:'node',id:1,lat,lon,tags:{name:'Музей природы у реки',tourism:'museum'}},
    {type:'node',id:2,lat:lat+0.003,lon,tags:{name:'Музей природы в центре',tourism:'museum'}},
    {type:'node',id:3,lat:lat+0.049,lon,tags:{name:'Далёкий ресторан',amenity:'restaurant'}},
  ];
  const result=await draftItinerary({...request,cityId:city.id,transport:'walking',required:['Музей природы']},
    {fetchImpl:async()=>new Response(JSON.stringify({elements}))});
  assert.equal(result.plan.required[0].reason,'ambiguous');
  assert.equal(result.plan.required[0].candidates.length,2);
  assert.ok(result.plan.days.every(day=>day.logistics.lunch.status==='missing'));
});

test('excluded themes outrank mandatory names and themed coverage counts only scheduled stops',async()=>{
  const city=(await listCities('Тюмень')).cities[0];
  const [lat,lon]=city.coordinates;
  const tags=[
    {name:'Городской музей',tourism:'museum'},
    {name:'Музей керамики',tourism:'museum',craft:'pottery'},
    {name:'Гончарная мастерская',craft:'pottery'},
    {name:'Городской монастырь',amenity:'monastery'},
    {name:'Авторемонт у дома',craft:'car_repair'},
  ];
  const requests=[];
  const fetchImpl=async uri=>{
    requests.push(new URL(uri).searchParams.get('data'));
    const elements=tags.map((tags,i)=>({type:'node',id:100+i,lat:lat+i*0.0001,lon,tags}));
    return new Response(JSON.stringify({elements}));
  };
  const result=await draftItinerary({...request,cityId:city.id,theme:'museum',interests:['craft','pilgrimage','nature'],
    excludedInterests:['museum'],required:['Музей керамики','Городской монастырь']},{fetchImpl});
  assert.equal(result.settings.theme,'any');
  assert.deepEqual(result.plan.interestCoverage,[{theme:'craft',count:1},{theme:'pilgrimage',count:1},{theme:'nature',count:0}]);
  assert.deepEqual(result.plan.required.map(item=>[item.matched.name,item.scheduled,item.excludedInterests]),
    [['Музей керамики',false,['museum']],['Городской монастырь',true,undefined]]);
  assert.ok(result.places.every(place=>!place.tags.includes('museum') && !place.name.includes('Авторемонт')));
  assert.ok(result.plan.days.flatMap(day=>day.stops).every(stop=>!stop.name.includes('музей')));
  assert.ok(requests[0].includes('amenity=monastery') && requests[0].includes('craft~'));
});

test('live city visits are supplemented by curated anchors and deduplicated by name and coordinates',async()=>{
  const fetchImpl=async url=>{
    if (!String(url).includes('wikipedia.org')) throw new Error('Overpass test timeout');
    return new Response(JSON.stringify({query:{geosearch:[
      {pageid:701,title:'Башня Сююмбике',lat:55.800525,lon:49.105194},
      {pageid:702,title:'Парк из каталога',lat:55.78874,lon:49.12214},
    ]}}));
  };
  const settings={...request,cityId:'551487',required:['Казанский кремль'],theme:'heritage'};
  const result=await draftItinerary(settings,{fetchImpl});
  assert.equal(result.source.id,'wikimedia');
  assert.equal(result.source.supplemental.status,'snapshot');
  assert.equal(result.geodata.places.Q603622.source,'https://www.wikidata.org/wiki/Q603622');
  assert.deepEqual(result.plan.required.map(item=>[item.matched.name,item.scheduled]),[['Казанский кремль',true]]);
  const towers=result.places.filter(place=>place.name==='Башня Сююмбике');
  assert.equal(towers.length,1);
  assert.deepEqual(towers[0].sources,['https://ru.wikipedia.org/?curid=701','https://www.wikidata.org/wiki/Q2166466']);

  const omitted=await draftItinerary({...settings,omittedIds:['Q603622']},{fetchImpl});
  assert.deepEqual(omitted.settings.omittedIds,['Q603622']);
  assert.equal(omitted.plan.required[0].omitted,true);
  assert.equal(omitted.plan.required[0].scheduled,false);
  assert.ok(!omitted.geodata.places.Q603622);
  assert.ok(omitted.plan.days.flatMap(day=>day.stops).every(stop=>stop.id!=='Q603622'));
});

test('provider aliases can satisfy a canonical required name without duplicate stops',async()=>{
  const fetchImpl=async ()=>new Response(JSON.stringify({elements:[
    {type:'node',id:301,lat:55.797442,lon:49.10724,tags:{name:'Кремль',historic:'castle'}},
  ]}));
  const result=await draftItinerary({...request,cityId:'551487',required:['Казанский кремль']},{fetchImpl});
  assert.equal(result.plan.required[0].matched.id,'osm-node-301');
  assert.equal(result.plan.required[0].scheduled,true);
  assert.equal(result.places.some(place=>place.id==='Q603622'),false);
  assert.ok(result.places.find(place=>place.id==='osm-node-301').aliases.includes('Казанский кремль'));
});

test('fallback labels add crafts and pilgrimage only when site names are explicit',async()=>{
  const {cities}=await listCities('Иркутск');
  const fetchImpl=async url=>{
    if (!String(url).includes('wikipedia.org')) throw new Error('Overpass test timeout');
    const [lat,lon]=cities[0].coordinates;
    return new Response(JSON.stringify({query:{geosearch:[
      {pageid:536,title:'Музей народных промыслов',lat,lon},
      {pageid:537,title:'Гончарная мастерская',lat:lat+0.0002,lon},
      {pageid:538,title:'Знаменский монастырь',lat:lat+0.0004,lon},
      {pageid:539,title:'Городской собор',lat:lat+0.0006,lon},
    ]}}));
  };
  const result=await draftItinerary({...request,cityId:cities[0].id,theme:'craft',interests:['pilgrimage'],
    excludedInterests:['museum']},{fetchImpl});
  assert.equal(result.source.id,'wikimedia');
  assert.deepEqual(result.plan.interestCoverage,[{theme:'craft',count:1},{theme:'pilgrimage',count:1}]);
  assert.ok(!result.places.find(place=>place.name==='Городской собор').tags.includes('pilgrimage'));
});

test('invalid dates, city IDs and group sizes are rejected',async()=>{
  await assert.rejects(draftItinerary({...request,date:'2026-02-30'}),{status:400});
  await assert.rejects(draftItinerary({...request,cityId:'0);out;'}),{status:400});
  await assert.rejects(draftItinerary({...request,size:101}),{status:400});
  await assert.rejects(draftItinerary({...request,days:7}),{status:400});
});
