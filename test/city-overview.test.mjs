import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createCityOverview, createLocalPlaceCatalog } from '../city-overview.mjs';
import { draftItinerary } from '../nationwide.mjs';

const load=name=>readFile(new URL('../data/'+name,import.meta.url),'utf8').then(JSON.parse);

test('city overview separates listed places, local forecast, regional statistics scope and project records',async()=>{
  const [catalog,mapData]=await Promise.all([load('catalog.json'),load('map.json')]);
  const project={id:'sample-culture-project',coordinates:[56.12,40.40],url:'https://example.com/permit'};
  const calls={catalog:0,weather:0,projects:0};
  const overview=createCityOverview({catalog,mapData,fetchImpl:async()=>{
    calls.catalog++;
    return new Response(null,{status:503});
  },
    now:()=>Date.parse('2026-11-18T22:00:00Z'),
    weatherForecast:async({points})=>{
      calls.weather++;
      return {source:{name:'Test weather'},days:points,horizonDays:7};
    },
    getCityProjects:async cityId=>{
      calls.projects++;
      return {status:'published',records:cityId==='473247'?[project]:[]};
    },
  });
  const result=await overview('473247');
  assert.equal(result.city.name,'Владимир');
  assert.equal(result.region.name,'Владимирская область');
  assert.equal(result.region.scope,'federal-subject');
  assert.equal(result.catalogScope,'city-and-nearby');
  assert.ok(result.places.some(place=>place.id==='amaks-food' && place.status==='unknown'));
  assert.ok(result.places.every(place=>place.city===result.city.name));
  assert.equal(result.counts.food,1);
  assert.equal(result.counts.stay,2);
  assert.equal(result.places.find(place=>place.id==='vladimir-hotel-vladimir').photo.src,'/assets/venue-vladimir-hotel.webp');
  assert.equal(Object.values(result.counts).reduce((a,b)=>a+b,0),result.places.length);
  assert.deepEqual(result.weather.days.map(({date})=>date),['2026-11-19','2026-11-20','2026-11-21']);
  assert.deepEqual(result.geodata.places[project.id],{coordinates:project.coordinates,source:project.url});
  assert.ok(!result.places.some(place=>place.id===project.id));
  assert.ok(result.catalogSources.some(source=>source.id==='pilot-place-catalog'));
  const chosen=result.places.find(place=>place.id==='amaks-food');
  const itinerary=await draftItinerary({cityId:result.city.id,date:'2026-11-21',days:2,size:8,requiredPlaceIds:[chosen.id]},
    {local:createLocalPlaceCatalog(catalog,mapData),fetchImpl:async()=>new Response(null,{status:503})});
  assert.equal(itinerary.plan.required[0].matched.id,chosen.id);
  assert.equal(itinerary.plan.required[0].scheduled,true);
  assert.ok(itinerary.plan.days.flatMap(day=>day.stops).some(stop=>stop.id===chosen.id && stop.status==='unknown'));
  const triggered={...calls};
  const disabled=await overview('473247',{includeWeather:false,includeCatalog:false,includeProjects:false});
  assert.deepEqual(calls,triggered);
  assert.equal(disabled.weather,null);
  assert.equal(disabled.projects.status,'disabled');
  assert.deepEqual(disabled.places,[]);
  assert.deepEqual(disabled.geodata.cities[result.city.name].coordinates,result.city.coordinates);
  await assert.rejects(()=>overview('../'),{status:400});
  await assert.rejects(()=>overview('999999999999'),{status:404});
});

test('city identity, projects and forecast load while the national catalogue is waiting on providers',{timeout:5000},async()=>{
  const {promise:started,resolve:markStarted}=Promise.withResolvers();
  const {promise:providerWait,resolve:releaseProvider}=Promise.withResolvers();
  const project={id:'sample-culture-project',coordinates:[55.8,49.1],url:'https://example.com/permit'};
  const overview=createCityOverview({
    local:{places:[]},
    now:()=>Date.parse('2026-11-18T22:00:00Z'),
    getCityProjects:async()=>({status:'published',records:[project]}),
    weatherForecast:async({points})=>({days:points}),
    fetchImpl:async()=>{
      markStarted();
      await providerWait;
      return new Response(null,{status:503});
    },
  });
  const catalogTask=overview('551487',{includeWeather:false,includeProjects:false});
  try {
    await started;
    const [core,forecast]=await Promise.all([
      overview('551487',{includeCatalog:false,includeWeather:false}),
      overview('551487',{includeCatalog:false,includeProjects:false}),
    ]);
    assert.equal(core.city.name,'Казань');
    assert.equal(core.region.scope,'federal-subject');
    assert.deepEqual(core.places,[]);
    assert.deepEqual(core.geodata.places[project.id],{coordinates:project.coordinates,source:project.url});
    assert.equal(core.weather,null);
    assert.equal(forecast.weather.days.length,3);
    assert.equal(forecast.projects.status,'disabled');
    assert.deepEqual(forecast.places,[]);
  } finally {
    releaseProvider();
  }
  const catalog=await catalogTask;
  assert.ok(catalog.places.some(place=>place.id==='kazan-tatar-estate'));
  assert.ok(catalog.catalogSources.some(source=>source.status==='snapshot'));
});
