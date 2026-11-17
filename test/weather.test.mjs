import assert from 'node:assert/strict';
import test from 'node:test';
import { createWeatherForecast } from '../weather.mjs';

const fixedDate=Date.parse('2026-11-17T22:15:00Z');
const point = (date,latitude=56.129,longitude=40.407)=>({date,latitude,longitude});
const daily = {
  time:['2026-11-18','2026-11-19','2026-11-20'], weather_code:[66,3,0],
  temperature_2m_min:[-2,-1,0], temperature_2m_max:[1,5,6],
  precipitation_probability_max:[72,null,0], wind_gusts_10m_max:[62,22,14],
};

test('reads location-dated forecasts, keeps real zeros and coalesces requests for the same city',async()=>{
  let requests=0;
  const forecast=createWeatherForecast({now:()=>fixedDate,fetchImpl:async url=>{
    requests++;
    const address = new URL(url);
    assert.equal(address.hostname,'api.open-meteo.com');
    assert.equal(address.searchParams.get('latitude'),'56.13');
    assert.equal(address.searchParams.get('timezone'),'auto');
    assert.equal(address.searchParams.get('forecast_days'),'7');
    return Response.json({daily});
  }});
  const result=await forecast({points:[point('2026-11-20'),point('2026-11-18'),point('2026-11-19')]});
  assert.deepEqual(result.days.map(day=>day.condition),['clear','freezing','cloudy']);
  assert.deepEqual(result.days.map(day=>day.precipitationChance),[0,72,null]);
  assert.equal(result.days[1].risk,'high');
  assert.deepEqual(result.days[1].reasons,['ice','strong-wind','wet']);
  assert.equal(result.source.name,'Open-Meteo');
  assert.equal(requests,1);
  const dates=await forecast({points:[point('2026-11-17'),point('2026-11-30'),point('2026-11-18',null,null)]});
  assert.deepEqual(dates.days.map(day=>day.status),['past','out-of-range','unavailable']);
  assert.equal(requests,1);
});

test('provider failures stay unknown, retry after a short pause and reject invalid inputs locally',async()=>{
  let requests=0;
  let timestamp=fixedDate;
  const forecast=createWeatherForecast({now:()=>timestamp,fetchImpl:async()=>{
    requests++;
    if (requests===1) throw Error('offline');
    return Response.json({daily});
  }});
  const request={points:[point('2026-11-18')]};
  assert.deepEqual((await forecast(request)).days,[{date:'2026-11-18',status:'unavailable'}]);
  assert.equal((await forecast(request)).days[0].status,'unavailable');
  assert.equal(requests,1);
  timestamp+=60_100;
  assert.equal((await forecast(request)).days[0].status,'forecast');
  assert.equal(requests,2);
  for (const invalid of [{}, {points:[]},{points:[point('2026-02-30')]},{points:[point('2026-11-18',91)]},
    {points:[point('2026-11-18','56.12')]},{points:[point('2026-11-18',null)]}]) {
    await assert.rejects(forecast(invalid),{status:400});
  }
  assert.equal(requests,2);
});
