import assert from 'node:assert/strict';
import test from 'node:test';
import {detectCities,draftItinerary,listCities} from '../nationwide.mjs';
import {parseBrief} from '../planner-brief.mjs';
import {MAX_DRAFT_DAYS} from '../draft-duration.mjs';

const offline = async () => { throw new Error('Test connection unavailable'); };
const request = {cityId:'524901',days:2,date:'2026-11-28',size:18,market:'zh',theme:'museum'};

test('countrywide gazetteer finds cities in different languages and regions',async()=>{
  const moscow = await listCities('Москва');
  assert.equal(moscow.source.license,'CC BY 4.0');
  assert.ok(moscow.total>180_000);
  assert.equal(moscow.cities[0].id,'524901');
  assert.equal(moscow.cities[0].cn,'莫斯科');
  assert.equal((await listCities('Vladivostok')).cities[0].id,'2013348');
  assert.equal((await listCities('符拉迪沃斯托克')).cities[0].id,'2013348');
  assert.equal((await listCities('海参崴')).cities[0].cn,'符拉迪沃斯托克');
  assert.equal((await listCities('Yekaterinburg')).cities[0].cn,'叶卡捷琳堡');
  assert.equal((await listCities('喀山')).cities[0].id,'551487');
  assert.equal((await listCities('новгород')).cities[0].name,'Нижний Новгород');
  assert.equal((await listCities('Верхоянск')).cities[0].name,'Верхоянск');
  const st=await listCities('Ставрополь');
  assert.equal(st.cities[0].id,'487846');
  assert.equal(st.cities[0].region,'Ставропольский край');
  assert.equal((await detectCities('Выходные в Ставрополе'))[0].id,'487846');
  assert.deepEqual((await listCities('Нет Такого Места')).cities,[]);
});

test('free-text city matching keeps whole words, inflections and multiple cities',async()=>{
  const found = await detectCities('Три дня в Нижнем Новгороде, затем по Казани и в Санкт-Петербурге');
  assert.deepEqual(found.map(place=>place.name),['Нижний Новгород','Казань','Санкт-Петербург']);
  assert.equal((await detectCities('Два дня во Владивостоке'))[0].id,'2013348');
  assert.equal((await detectCities('周末去喀山玩两天'))[0].id,'551487');
  assert.deepEqual(await detectCities('Подмосковный парк и петербургский музей'),[]);
});

test('free-text city matching keeps the smaller regional capitals in explicit routes',async()=>{
  for (const [brief,names] of [
    ['Калининград — Анадырь на два дня.', ['Калининград','Анадырь']],
    ['Магас → Нарьян-Мар на два дня.', ['Магас','Нарьян-Мар']],
    ['Москва. Не едем в Анадырь.', ['Москва']],
    ['Живописный лес, музей и новые деревни.', []],
  ]) assert.deepEqual((await detectCities(brief)).map(city=>city.name),names);
});

test('national planner resolves common alternate city names and ignores directly excluded destinations',async()=>{
  for (const [input, expected] of [
    ['Уфа для восемнадцати гостей, не едем в Казань.',['Уфа']],
    ['В Москву не едем. Нужна Уфа.',['Уфа']],
    ['Два дня в Казани. Не едем в Москву.',['Казань']],
    ['Two days in Saint Petersburg, skip Moscow.',['Санкт-Петербург']],
    ['Two days in St. Petersburg. Moscow is excluded.',['Санкт-Петербург']],
    ['符拉迪沃斯托克三天，海边散步。不去莫斯科。',['Владивосток']],
    ['不去莫斯科。叶卡捷琳堡两天。',['Екатеринбург']],
    ['Не едем в Казань напрямую. Сначала Уфа, затем Казань.',['Уфа','Казань']],
  ]) assert.deepEqual((await detectCities(input)).map(city=>city.name),expected);
});

test('South Sakhalinsk supports current and historical Chinese names in both brief and city search',async()=>{
  const [city]=await detectCities('南萨哈林斯克三天，明天出发，十四人，中国团队。');
  assert.equal(city?.id,'2119441');
  assert.equal(city.cn,'南萨哈林斯克');
  assert.equal(city.timezone,'Asia/Sakhalin');
  for (const query of ['南萨哈林斯克','南萨哈林斯克市','南薩哈林斯克','豐原']) {
    const [result]=(await listCities(query)).cities;
    assert.equal(result?.id,city.id);
    assert.equal(result.cn,city.cn);
  }
});

test('a Chinese South Sakhalinsk brief schedules a park and sourced food and lodging from the offline catalog',async()=>{
  const brief='南萨哈林斯克三天，明天出发，十四人，中国团队。历史、博物馆、公园。';
  const [city]=await detectCities(brief);
  const result=await draftItinerary(
    {...parseBrief(brief,'2026-11-27'),cityId:city.id},{fetchImpl:offline});
  assert.equal(result.source.status,'snapshot');
  assert.equal(result.settings.market,'zh');
  assert.equal(result.settings.size,14);
  const park=result.plan.days.flatMap(day=>day.stops).find(stop=>stop.id==='osm-relation-7809929');
  assert.ok(park && park.type==='visit' && park.exposure==='outdoors');
  assert.ok(result.plan.interestCoverage.some(({theme,count})=>theme==='nature' && count>0));
  assert.equal(result.geodata.places[park.id].source,'https://www.openstreetmap.org/relation/7809929');
  assert.deepEqual(result.plan.days.map(day=>day.stops.some(stop=>stop.type==='food')),[true,true,true]);
  assert.deepEqual(result.plan.days.map(day=>day.stops.some(stop=>stop.type==='stay')),[true,true,false]);
  const amenities=result.places.filter(place=>['food','stay'].includes(place.kind));
  assert.equal(amenities.length,4);
  for (const place of amenities) {
    assert.ok(place.cn);
    assert.ok(place.url.startsWith('https://'));
    assert.equal(place.status,'unknown');
    assert.equal(result.geodata.places[place.id].source,place.geoUrl ?? place.url);
  }
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
  records.push({type:'node',id:121,lat:55.753,lon:37.61765,tags:{
    name:'Кафе рядом',amenity:'restaurant','addr:street':'Тверская улица','addr:housenumber':'3',
  }});
  records.push({type:'way',id:122,center:{lat:55.753,lon:37.61765},tags:{name:'Отель рядом',tourism:'hotel'}});
  const fetchImpl = async url=>{
    endpoints.push(String(url));
    return new Response(JSON.stringify({elements:records}),{headers:{'Content-Type':'application/json'}});
  };
  const required=['Дальний парк','Мой секретный текст'];
  const relaxed=await draftItinerary({...request,pace:'relaxed',transport:'walking',required},{fetchImpl});
  const dense=await draftItinerary({...request,pace:'dense',transport:'car',required},{fetchImpl});
  assert.equal(dense.source.status,'live');
  assert.equal(dense.places.find(place=>place.id==='osm-node-121').address,'Тверская улица, 3');
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
    assert.equal(day.transfer.timing.status,'unconfirmed');
    assert.ok(day.missing.some(text=>text.includes('переезд')));
    assert.ok(day.stops.every(stop=>stop.type!=='travel'));
  }
  assert.ok(result.geodata.cities.Владивосток.coordinates[1]>100);
  await assert.rejects(draftItinerary({...request,additionalCityIds:['551487','2013348']},{fetchImpl:offline}),{status:400});
});

test('a one-day draft keeps a required visit and lunch without offering lodging',async()=>{
  const single={...request,cityId:'551487',days:1,required:['Казанский кремль']};
  const {plan}=await draftItinerary(single,{fetchImpl:offline});
  assert.equal(plan.days.length,1);
  assert.equal(plan.required[0].scheduled,true);
  const [day]=plan.days;
  assert.ok(day.stops.some(stop=>stop.required && stop.type==='visit'));
  assert.ok(day.stops.some(stop=>stop.type==='food'));
  assert.ok(day.stops.every(stop=>stop.type!=='stay'));
  assert.equal(day.logistics.overnight.status,'not-required');
  await assert.rejects(draftItinerary({...single,additionalCityIds:['524901']},{fetchImpl:offline}),{status:400});
});

test('a fourteen-day draft balances cities in order and covers the full calendar without repeated visits',async()=>{
  const {plan}=await draftItinerary({...request,days:MAX_DRAFT_DAYS,date:'2026-12-24',
    additionalCityIds:['551487','498817'],required:['Красная площадь','Казанский кремль']},{fetchImpl:offline});
  assert.equal(plan.days.length,MAX_DRAFT_DAYS);
  assert.equal(plan.days.at(-1).date,'2027-01-06');
  assert.deepEqual(plan.days.map(day=>day.cityId),[
    ...Array(4).fill('524901'),...Array(5).fill('551487'),...Array(5).fill('498817'),
  ]);
  assert.deepEqual(plan.days.flatMap((day,index)=>day.transfer ? [index] : []),[4,9]);
  assert.ok(plan.required.every(item=>item.scheduled));
  const visits=plan.days.flatMap(day=>day.stops.filter(stop=>stop.type==='visit').map(stop=>stop.id));
  assert.equal(visits.length,new Set(visits).size);
  const [first,second]=plan.days;
  assert.equal(first.logistics.overnight.status,'suggested');
  assert.equal(second.logistics.originStayId,first.logistics.overnight.id);
  assert.equal(plan.days.at(-1).logistics.overnight.status,'not-required');
});

test('date comparison keeps the full trip inside the supported calendar',async()=>{
  const options={fetchImpl:offline,compareDates:true};
  const input={...request,days:MAX_DRAFT_DAYS,date:'2099-12-16'};
  const compared=await draftItinerary(input,options);
  assert.equal(compared.current.date,input.date);
  assert.equal(compared.datesChecked,2);
  assert.deepEqual(compared.options.map(option=>option.date).sort(),['2099-12-17','2099-12-18']);
  await assert.rejects(draftItinerary({...input,date:'2099-12-19'},options),{status:400});
  const lastDay=await draftItinerary({...input,date:'2099-12-31',days:1},options);
  assert.equal(lastDay.current.date,'2099-12-31');
  assert.equal(lastDay.datesChecked,0);
  assert.deepEqual(lastDay.options,[]);
});

test('a long by-car leg reserves arrival time and offers unscheduled sightseeing separately',async()=>{
  const result=await draftItinerary({...request,days:3,size:8,transport:'car',additionalCityIds:['551487'],
    required:['Казанский кремль']},{fetchImpl:offline});
  const [,arrival,nextDay]=result.plan.days;
  assert.equal(arrival.transfer.status,'unknown');
  assert.equal(arrival.transfer.timing.status,'estimated');
  assert.equal(arrival.transfer.timing.departureTime,'08:00');
  assert.equal(arrival.transfer.timing.arrivalDate,arrival.date);
  assert.ok(arrival.transfer.timing.arrivalTime>'18:00');
  assert.equal(arrival.transfer.timing.visitsLimited,true);
  assert.ok(arrival.stops.every(stop=>stop.type!=='visit' && stop.start>=arrival.transfer.timing.arrivalTime));
  assert.ok(arrival.transfer.candidates.some(place=>place.id==='Q603622'));
  assert.ok(nextDay.stops.some(stop=>stop.id==='Q603622' && stop.required));
});

test('a road arrival beyond the trip does not schedule visits on later days in that city',async()=>{
  const result=await draftItinerary({...request,days:3,transport:'car',additionalCityIds:['2013348'],
    required:['Владивостокская крепость']},{fetchImpl:offline});
  const [departure,...unreached]=result.plan.days;
  const [first,last]=unreached;
  assert.ok(departure.stops.length);
  assert.ok(first.transfer.timing.reserveMinutes>3*24*60);
  assert.ok(first.transfer.timing.arrivalDate>last.date);
  assert.ok(unreached.every(day=>day.logistics.arrivalAfterDay && day.logistics.arrivalPending && day.stops.length===0));
  assert.equal(result.plan.required[0].scheduled,false);
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
  const city=(await listCities('Псков')).cities[0];
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
  const city=(await listCities('Псков')).cities[0];
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

test('a last-day replacement is accepted and shortening the draft discards only that change',async()=>{
  const [city]=(await listCities('Псков')).cities;
  const [lat,lon]=city.coordinates;
  const point=(id,tags)=>({type:'node',id,lat:lat+id*.00001,lon,tags});
  const cafes=Array.from({length:MAX_DRAFT_DAYS+2},(_,i)=>point(i+1,{name:`Кафе квартала ${i+1}`,amenity:'cafe'}));
  const elements=[...cafes,point(100,{name:'Музей',tourism:'museum'}),point(101,{name:'Гостиница',tourism:'hotel'})];
  const options={fetchImpl:async()=>Response.json({elements})};
  const input={...request,cityId:city.id,days:MAX_DRAFT_DAYS};
  const baseline=await draftItinerary(input,options);
  const lunch=baseline.plan.days.at(-1).stops.find(stop=>stop.type==='food');
  const operation={day:MAX_DRAFT_DAYS-1,fromId:lunch.id,toId:lunch.alternatives[0].id};
  const changed=await draftItinerary({...input,replacements:[operation]},options);
  assert.deepEqual(changed.plan.replacements,[{...operation,status:'applied'}]);
  assert.equal(changed.plan.days.at(-1).logistics.lunch.id,operation.toId);
  const shortened=await draftItinerary({...input,days:1,replacements:[operation]},options);
  assert.deepEqual(shortened.plan.replacements,[{...operation,status:'rejected',reason:'day-unavailable'}]);
  assert.equal(shortened.plan.days.length,1);
  await assert.rejects(draftItinerary({...input,replacements:[{...operation,day:MAX_DRAFT_DAYS}]},options),{status:400});
});

test('an outdoor stop offers an indoor same-time candidate for checking before a trip',async()=>{
  const city=(await listCities('Псков')).cities[0];
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
  const city=(await listCities('Псков')).cities[0];
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
  const city=(await listCities('Псков')).cities[0];
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

test('a nearby exact alias of the curated Tambov embankment merges without conflating other places',async()=>{
  const fetchImpl=async url=>{
    if (!String(url).includes('wikipedia.org')) throw new Error('Overpass unavailable');
    return Response.json({query:{geosearch:[
      {pageid:820,title:'Набережная улица (Тамбов)',lat:52.713456,lon:41.471525},
      {pageid:821,title:'Набережная улица Центральная',lat:52.713456,lon:41.471525},
    ]}});
  };
  const [city]=await detectCities('Два дня в Тамбове');
  const result=await draftItinerary({...request,cityId:city.id},{fetchImpl});
  const merged=result.places.find(place=>place.id==='ruwiki-820');
  assert.ok(merged.sourceIds.includes('tambov-tsna'));
  assert.ok(merged.aliases.includes('Набережная Цны'));
  assert.equal(result.places.some(place=>place.id==='tambov-tsna'),false);
  assert.ok(result.places.some(place=>place.id==='ruwiki-821'));
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

test('Wikipedia buildings with no visitor function are excluded while a named metro museum remains a visit',async()=>{
  const {cities}=await listCities('Иркутск');
  const [lat,lon]=cities[0].coordinates;
  const fetchImpl=async url=>{
    if (!String(url).includes('wikipedia.org')) throw new Error('Overpass test timeout');
    return Response.json({query:{geosearch:[
      {pageid:810,title:'Площадь Тукая (станция метро)',lat,lon},
      {pageid:811,title:'Здание администрации',lat:lat+0.001,lon},
      {pageid:812,title:'Музей истории метро',lat:lat+0.002,lon},
      {pageid:813,title:'Жилой дом И. И. Сатина',lat:lat+0.003,lon},
      {pageid:814,title:'Доходный дом страхового общества «Саламандра»',lat:lat+0.004,lon},
    ]}});
  };
  const result=await draftItinerary({...request,cityId:cities[0].id},{fetchImpl});
  assert.deepEqual(result.places.map(place=>place.id),['ruwiki-812']);
  assert.ok(result.plan.days.flatMap(day=>day.stops).some(stop=>stop.id==='ruwiki-812'));
});

test('gastro counts only distinct culinary places supported by map details',async()=>{
  const city=(await listCities('Псков')).cities[0];
  const [lat,lon]=city.coordinates;
  const place=(id,name,tags)=>({type:'node',id,lat,lon:lon+id*0.0001,tags:{name,...tags}});
  const elements=[
    place(1,'Музей хлеба',{tourism:'museum'}),
    place(2,'Городской рынок',{amenity:'marketplace'}),
    place(3,'Фермерский рынок',{amenity:'marketplace'}),
    place(4,'Местная кухня',{amenity:'restaurant',cuisine:'regional'}),
    place(5,'Быстрый обед',{amenity:'restaurant',cuisine:'international'}),
    place(6,'Дом истории',{tourism:'museum'}),
  ];
  const result=await draftItinerary({...request,cityId:city.id,days:3,theme:'gastro'},{fetchImpl:async()=>Response.json({elements})});
  const stops=result.plan.days.flatMap(day=>day.stops);
  assert.ok(stops.some(stop=>stop.type==='food' && stop.gastro && stop.cuisineHint==='regional'));
  assert.ok(stops.some(stop=>stop.name==='Фермерский рынок' && stop.gastro));
  assert.ok(!result.places.some(place=>place.name==='Городской рынок'));
  assert.ok(!result.places.find(place=>place.name==='Быстрый обед').tags.includes('gastro'));
  assert.deepEqual(result.plan.interestCoverage,[{theme:'gastro',count:new Set(stops.filter(stop=>stop.gastro).map(stop=>stop.id)).size}]);
});

test('Kazan culinary opening hours and official links survive a live-source merge, including a sourced restaurant',async()=>{
  const city=(await listCities('Казань')).cities[0];
  const fetchImpl=async()=>Response.json({elements:[
    {type:'node',id:901,lat:55.782035,lon:49.112529,tags:{name:'Музей Чак-чака',tourism:'museum'}},
    {type:'node',id:902,lat:55.7812,lon:49.116,tags:{name:'Обычный ресторан',amenity:'restaurant'}},
  ]});
  const result=await draftItinerary({...request,cityId:city.id,theme:'gastro',size:8,
    required:['Музей чак-чака']},{fetchImpl});
  const stops=result.plan.days.flatMap(day=>day.stops);
  const museum=stops.find(stop=>stop.id==='osm-node-901');
  assert.ok(museum.gastro && museum.status==='unknown');
  assert.equal(museum.url,'https://chak-chak.museum/');
  assert.ok(museum.start>='10:00');
  assert.ok(stops.some(stop=>stop.type==='food' && stop.gastro));
});

test('exact pins schedule food and lodging, deduplicate required names and report unavailable ids',async()=>{
  const result=await draftItinerary({...request,cityId:'551487',size:8,required:['Гранд Отель Казань','Ресторан «Татарская усадьба»'],
    requiredPlaceIds:['kazan-grand-hotel','kazan-tatar-estate','missing-provider-venue','kazan-grand-hotel']},{fetchImpl:offline});
  assert.deepEqual(result.settings.requiredPlaceIds,['kazan-grand-hotel','kazan-tatar-estate','missing-provider-venue']);
  assert.deepEqual(result.plan.required.map(({requestedId,scheduled,reason})=>[requestedId,scheduled,reason]),[
    ['kazan-grand-hotel',true,undefined],['kazan-tatar-estate',true,undefined],['missing-provider-venue',false,'not-found'],
  ]);
  const stops=result.plan.days.flatMap(day=>day.stops);
  assert.ok(stops.some(stop=>stop.type==='stay' && stop.id==='kazan-grand-hotel' && stop.required));
  assert.ok(stops.some(stop=>stop.type==='food' && stop.id==='kazan-tatar-estate' && stop.required));
  const competing=await draftItinerary({...request,cityId:'551487',requiredPlaceIds:['kazan-grand-hotel','kazan-shalyapin-palace']},{fetchImpl:offline});
  const missed=competing.plan.required.filter(item=>!item.scheduled);
  assert.equal(missed.length,1);
  assert.equal(missed[0].reason,'no-slot');
  await assert.rejects(draftItinerary({...request,requiredPlaceIds:['invalid id']},{fetchImpl:offline}),{status:400});
  await assert.rejects(draftItinerary({...request,requiredPlaceIds:Array.from({length:11},(_,i)=>'venue-'+i)},{fetchImpl:offline}),{status:400});
});

test('a visit-only Saint Petersburg source still offers provisional group dining and lodging with venue links',async()=>{
  const elements=Array.from({length:12},(_,index)=>({
    type:'node',id:300+index,lat:59.93+index/2000,lon:30.34,
    tags:{name:'Петербургский музей '+index,tourism:'museum'},
  }));
  const result=await draftItinerary({...request,cityId:'498817',days:3,size:6,access:true},
    {fetchImpl:async()=>Response.json({elements})});
  assert.equal(result.source.status,'live');
  assert.equal(result.source.supplemental.status,'snapshot');
  const restaurants=result.places.filter(place=>place.kind==='food');
  assert.ok(restaurants.length>=5);
  assert.ok(restaurants.some(place=>place.id==='spb-palkin' && place.address==='Невский проспект, 47'));
  assert.equal(result.places.filter(place=>place.kind==='stay').length,3);
  assert.ok(result.plan.days.every(day=>day.stops.some(stop=>stop.type==='food')));
  const overnightIds=result.plan.days.slice(0,2).map(day=>day.stops.find(stop=>stop.type==='stay')?.id);
  assert.ok(overnightIds[0]);
  assert.equal(overnightIds[0],overnightIds[1]);
  const logistics=result.plan.days.flatMap(day=>day.stops.filter(stop=>stop.type!=='visit'));
  for (const stop of logistics) {
    assert.equal(stop.status,'unknown');
    assert.match(stop.url,/^https:\/\//u);
  }
});

test('Hermitage hours apply to the selected day and retain the mandatory museum with a slow provider',async()=>{
  const result=await draftItinerary({...request,cityId:'498817',date:'2026-11-23',size:8,required:['Государственный Эрмитаж']},
    {fetchImpl:offline});
  assert.equal(result.plan.required[0].scheduled,true);
  assert.equal(result.plan.days[0].stops.some(stop=>stop.id==='Q132783'),false);
  const hermitage=result.plan.days[1].stops.find(stop=>stop.id==='Q132783');
  assert.ok(hermitage.start>='11:00');
  assert.equal(hermitage.status,'unknown');
  assert.deepEqual(hermitage.openingHours,{opens:'11:00',closes:'20:00'});
});

test('a two-day walking itinerary can pair the Tambov centre and a second local area with suitable lunch stops',async()=>{
  const [city]=(await listCities('Тамбов')).cities;
  const [latitude,longitude]=city.coordinates;
  const point=(id,name,latOffset,lonOffset,tags)=>({
    type:'node',id,lat:latitude+latOffset,lon:longitude+lonOffset,tags:{name,...tags},
  });
  const records=[
    ...Array.from({length:7},(_,i)=>point(100+i,'Исторический объект '+(i+1),
      0.0005+i*.00016,i*.0001,{historic:'monument'})),
    ...Array.from({length:3},(_,i)=>point(200+i,'Парк '+(i+1),0.013+i*.001,
      0.002+i*.0004,{leisure:'park'})),
    point(301,'Гостиница',0.0009,0.0004,{tourism:'hotel'}),
    point(302,'Ресторан центра',0.0008,0.0004,{amenity:'restaurant'}),
    point(303,'Ресторан рядом с парком',0.0136,0.0024,{amenity:'restaurant'}),
  ];
  const result=await draftItinerary({...request,cityId:city.id,days:2,date:'2026-11-21',transport:'walking',
    theme:'heritage',interests:['nature'],size:8,required:['Исторический объект 1']},
    {fetchImpl:async()=>Response.json({elements:records})});
  const [first,second]=result.plan.days;
  assert.equal(first.focus.theme,'heritage');
  assert.equal(second.focus.theme,'nature');
  assert.ok(first.stops.some(stop=>stop.id==='osm-node-100' && stop.required));
  assert.ok(first.stops.filter(stop=>stop.type==='visit').every(stop=>stop.coordinates[0]-latitude<0.002));
  assert.ok(second.stops.filter(stop=>stop.type==='visit' && stop.coordinates[0]-latitude>0.01).length>=2);
  assert.equal(second.logistics.lunch.id,'osm-node-303');
  for (const day of [first,second]) {
    assert.ok(day.focus.placeIds.every(id=>day.stops.some(stop=>stop.id===id)));
    assert.ok(day.stops.every(stop=>stop.leg.mode==='walking' && stop.leg.distanceKm<=2.6 &&
      stop.status==='unknown' && !stop.openingHours));
  }
});

test('a full itinerary favors distinct visits while keeping nearby memorials and museum branches available as exact pins',async()=>{
  const [city]=(await listCities('Псков')).cities;
  const [lat,lon]=city.coordinates;
  const point=(id,name,offset,tags)=>({type:'node',id,lat:lat+offset,lon,tags:{name,...tags}});
  const elements=[
    point(1,'Дом-музей архитектора',.00012,{tourism:'museum'}),
    point(2,'Архитектор',.00017,{historic:'memorial',artwork_type:'bust'}),
    point(3,'Второй корпус музея',.00042,{tourism:'museum'}),
    point(4,'Крепость на холме',.006,{historic:'castle'}),
    point(5,'Городской ботанический сад',.0085,{leisure:'garden'}),
    point(6,'Музей мостов',.0103,{tourism:'museum'}),
    point(7,'Ресторан',.0029,{amenity:'restaurant'}),
    point(8,'Гостиница',.0044,{tourism:'hotel'}),
  ];
  const input={...request,cityId:city.id,theme:'heritage',interests:['museum'],pace:'relaxed',transport:'walking'};
  const options={fetchImpl:async()=>Response.json({elements})};
  const draft=await draftItinerary({...input,requiredPlaceIds:['osm-node-1']},options);
  const visits=draft.plan.days.flatMap(day=>day.stops.filter(stop=>stop.type==='visit'));
  assert.deepEqual(new Set(visits.map(stop=>stop.id)),new Set([1,4,5,6].map(id=>'osm-node-'+id)));
  assert.ok(visits.every(stop=>stop.status==='unknown' && stop.leg.mode==='walking'));
  for (const id of ['osm-node-2','osm-node-3']) {
    assert.ok(draft.places.some(place=>place.id===id));
    const pinned=await draftItinerary({...input,requiredPlaceIds:['osm-node-1',id]},options);
    assert.ok(pinned.plan.required.every(stop=>stop.scheduled));
  }
});

test('a hotel with an official catalog listing keeps the same selection with or without live venue results',async()=>{
  const query={...request,cityId:'498817',requiredPlaceIds:['spb-saint-petersburg-hotel','spb-helvetia-hotel']};
  const live=async()=>Response.json({elements:[
    {type:'node',id:981,lat:59.92965,lon:30.35378,tags:{name:'Отель «Гельвеция»',tourism:'hotel'}},
  ]});
  for (const fetchImpl of [live,offline]) {
    const draft=await draftItinerary(query,{fetchImpl});
    assert.equal(draft.places.filter(place=>place.name.includes('Гельвеция')).length,1);
    assert.ok(draft.places.some(place=>place.id==='spb-saint-petersburg-hotel'));
    assert.ok(draft.plan.required.every(item=>item.matched?.id===item.requestedId));
  }
});

test('invalid dates, city IDs and group sizes are rejected',async()=>{
  await assert.rejects(draftItinerary({...request,date:'2026-02-30'}),{status:400});
  await assert.rejects(draftItinerary({...request,cityId:'0);out;'}),{status:400});
  await assert.rejects(draftItinerary({...request,size:101}),{status:400});
  for (const days of [0,MAX_DRAFT_DAYS+1,2.5,true]) {
    await assert.rejects(draftItinerary({...request,days}),{status:400});
  }
});
