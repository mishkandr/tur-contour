import { MAX_DRAFT_DAYS } from './draft-duration.mjs';

const horizonDays = 7;
const source = {name:'Open-Meteo',url:'https://open-meteo.com/'};
const fields = {
  code:'weather_code', lowC:'temperature_2m_min', highC:'temperature_2m_max',
  precipitationChance:'precipitation_probability_max', gustKmh:'wind_gusts_10m_max',
};
const conditions = {
  clear:[0,1], cloudy:[2,3], fog:[45,48], rain:[51,53,55,61,63,65,80,81,82],
  snow:[71,73,75,77,85,86], freezing:[56,57,66,67], thunder:[95,96,97,99],
};
const conditionByCode = new Map(Object.entries(conditions).flatMap(([condition,codes])=>codes.map(code=>[code,condition])));
const dayMs = 86_400_000;
const dateAt = time=>new Date(time).toISOString().slice(0,10);
const validDate = date=>typeof date==='string' && /^20\d{2}-\d{2}-\d{2}$/u.test(date) &&
  Number.isFinite(Date.parse(date)) && dateAt(Date.parse(date))===date;
const validCoordinate = (value,limit)=>Number.isFinite(value) && Math.abs(value)<=limit;

function describeDay(date,daily,index,checkedAt) {
  const values = Object.fromEntries(Object.entries(fields).map(([key,field])=>{
    const value = daily[field]?.[index];
    return [key,Number.isFinite(value) ? Math.round(value) : null];
  }));
  const {code,lowC,highC,precipitationChance,gustKmh} = values;
  if (Object.values(values).every(value=>value===null)) return {date,status:'unavailable'};
  const condition = conditionByCode.get(code) ?? 'unknown';
  const reasons = [];
  if (condition==='thunder') reasons.push('thunder');
  if (condition==='freezing') reasons.push('ice');
  if (gustKmh>=45) reasons.push('strong-wind');
  if (['rain','snow'].includes(condition) || precipitationChance>=60) reasons.push('wet');
  if (highC>=32) reasons.push('heat');
  if (lowC!==null && lowC<=-15) reasons.push('cold');
  const highRisk = ['thunder','freezing'].includes(condition) || gustKmh>=60 || [65,75,82,86].includes(code);
  return {date,status:'forecast',checkedAt,condition,lowC,highC,precipitationChance,gustKmh,
    risk:highRisk ? 'high' : reasons.length ? 'watch' : 'none',reasons};
}

export function createWeatherForecast({fetchImpl=(...args)=>fetch(...args),now=Date.now}={}) {
  const cache = new Map();
  const pending = new Map();
  let requestBudget = 36;
  let budgetCheckedAt = now();
  async function load(latitude,longitude) {
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const cached = cache.get(key);
    if (cached?.expires>now()) return cached.result;
    if (pending.has(key)) return pending.get(key);
    if (pending.size>=8) return null;
    const checkedAt = now();
    requestBudget = Math.min(36,requestBudget+Math.max(0,checkedAt-budgetCheckedAt)/15_000);
    budgetCheckedAt = checkedAt;
    if (requestBudget<1) return null;
    requestBudget-=1;
    const [lat,lon] = key.split(',');
    const query = new URLSearchParams({latitude:lat,longitude:lon,timezone:'auto',forecast_days:String(horizonDays),
      daily:Object.values(fields).join(',')});
    const request = Promise.resolve().then(async()=>{
      try {
        const response = await fetchImpl('https://api.open-meteo.com/v1/forecast?'+query,{signal:AbortSignal.timeout(4500),redirect:'error'});
        if (!response.ok) return null;
        const {daily} = await response.json();
        if (!Array.isArray(daily?.time) || !daily.time.length || !daily.time.every(validDate)) return null;
        return {daily,checkedAt:new Date(now()).toISOString()};
      } catch {
        return null;
      }
    }).then(result=>{
      pending.delete(key);
      cache.delete(key);
      if (cache.size>=128) cache.delete(cache.keys().next().value);
      cache.set(key,{result,expires:now()+(result ? 15*60_000 : 60_000)});
      return result;
    });
    pending.set(key,request);
    return request;
  }

  return async function weatherForecast({points}) {
    if (!Array.isArray(points) || points.length<1 || points.length>MAX_DRAFT_DAYS || points.some(point=>
      !validDate(point?.date) || !(point.latitude==null && point.longitude==null ||
      validCoordinate(point.latitude,90) && validCoordinate(point.longitude,180)))) {
      throw Object.assign(new Error(`Укажите от 1 до ${MAX_DRAFT_DAYS} дат и координаты для прогноза.`),{status:400});
    }
    const today = Date.parse(dateAt(now()));
    const days = await Promise.all(points.map(async({date,latitude,longitude})=>{
      // Allow one day on either side for UTC offsets before checking the location's date range.
      if (date<dateAt(today-dayMs)) return {date,status:'past'};
      if (date>dateAt(today+horizonDays*dayMs)) return {date,status:'out-of-range'};
      if (latitude==null) return {date,status:'unavailable'};
      const result = await load(latitude,longitude);
      if (!result) return {date,status:'unavailable'};
      const {daily,checkedAt} = result;
      const index = daily.time.indexOf(date);
      if (index>=0) return describeDay(date,daily,index,checkedAt);
      if (date<daily.time[0]) return {date,status:'past'};
      if (date>daily.time.at(-1)) return {date,status:'out-of-range'};
      return {date,status:'unavailable'};
    }));
    return {source,days,horizonDays};
  };
}
