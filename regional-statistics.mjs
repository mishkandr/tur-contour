import { readFile } from 'node:fs/promises';
import { metricInfo, months, officialStatistics, statSummary } from './engine.mjs';

const api = 'https://roschart.ru/api/';
const catalogueUrl = 'https://roschart.ru/docs';
const refreshPeriod = 12 * 60 * 60 * 1000;
const retryPeriod = 60 * 1000;
const methodologyChange = {from:'2026-01',source:'https://rosstat.gov.ru/storage/mediabank/met168-08042026.pdf'};
const monthColumns = months.map((month,index)=>index ? 'январь-'+month : month);
const editionId = /^(0[1-9]|1[0-2])-20\d{2}$/u;
const metrics = {
  nights:{query:'число ночевок в средствах размещения',prefix:'chislo-nochevok'},
  people:{query:'численность размещенных лиц в средствах размещения',prefix:'chislennost-razmeschennyh-lic'},
};
const exactNames = {
  '89':'Еврейская автономная область',
};
let registry;

function regionRegistry() {
  registry ??= readFile(new URL('./data/russia-cities.json',import.meta.url),'utf8').then(raw=>{
    const {cities,regions} = JSON.parse(raw);
    const regionById = new Map(Object.entries(regions).map(([id,[ruName,en,cn]])=>{
      const name = exactNames[id] ?? ruName.replace(/ (Область|Край)$/u,word=>word.toLowerCase());
      return [id,{id,name,en,cn,scope:'federal-subject'}];
    }));
    const cityRegion = new Map(cities.map(row=>[String(row[0]),row[7]]));
    return {regionById,cityRegion};
  });
  return registry;
}

export async function statisticsRegions() {
  const {regionById} = await regionRegistry();
  return [...regionById.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru')).map(area=>({...area}));
}

export async function regionForCity(cityId) {
  const {regionById,cityRegion} = await regionRegistry();
  const region = regionById.get(cityRegion.get(String(cityId)));
  return region ? {...region} : null;
}

const normalizedName = value => String(value ?? '').normalize('NFKC').toLowerCase().replaceAll('ё','е')
  .replace(/[–—−]/g,'-').replace(/\s*-\s*/g,'-').replace(/\s+/g,' ').trim();

function seriesForRegion(workbook,metric,region,checkedAt) {
  const exact = workbook.series.filter(row=>normalizedName(row.row)===normalizedName(region.name));
  const rows = new Map(exact.map(row=>[row.col,row.values]));
  if (!exact.length) return null;
  if (exact.length!==12 || rows.size!==12 || monthColumns.some(column=>!Array.isArray(rows.get(column)) ||
      rows.get(column).length!==workbook.periods.length)) return null;
  const years = workbook.periods.map((year,index)=>{
    let previous = 0;
    const monthly = monthColumns.map(column=>{
      const cumulative = rows.get(column)[index];
      const value = Number.isFinite(cumulative) && Number.isFinite(previous) && cumulative>=previous
        ? cumulative-previous : null;
      previous = cumulative;
      return value;
    });
    return {year:Number(year),monthly,total:monthly.every(Number.isFinite) ? previous : null};
  }).sort((a,b)=>a.year-b.year);
  if (!years.some(year=>year.monthly.some(Number.isFinite))) return null;
  return {metric,...metricInfo[metric],region:exact[0].row,regionId:region.id,geographicScope:region.scope,
    years,source:workbook.source,publication:officialStatistics,edition:workbook.edition,checkedAt};
}

const invalidInput = message => Object.assign(new Error(message),{status:400});
const timestamp = value => new Date(value).toISOString();

export function createRegionalStatistics({fetchImpl=globalThis.fetch,apiKey,edition,now=Date.now}={}) {
  if (edition && !editionId.test(edition)) throw new Error('Ожидается код выпуска Росстата MM-YYYY.');
  const editions = new Map();
  const workbooks = new Map();
  const scoped = new Map();
  const inFlight = new Map();
  let blockedUntil = 0;

  async function fetchJson(path,query) {
    const started = now();
    if (started<blockedUntil) throw Object.assign(new Error('Лимит запросов к источнику.'),{reason:'rate-limit'});
    const url = new URL(path,api);
    if (query) url.search = new URLSearchParams(query);
    const headers = {'User-Agent':'TurContour/2.0 (https://github.com/mishkandr/tur-contour)','Accept':'application/json'};
    if (apiKey) headers['X-API-Key'] = apiKey;
    const response = await fetchImpl(url,{headers,signal:AbortSignal.timeout(8000)});
    if (response.status===429) {
      const value = response.headers?.get('retry-after');
      const until = /^\d+$/.test(value ?? '') ? now()+Number(value)*1000 : Date.parse(value);
      const fallback = now()+retryPeriod;
      blockedUntil = Math.max(blockedUntil,Number.isFinite(until) ? Math.min(until,now()+24*60*60*1000) : fallback);
      throw Object.assign(new Error('Лимит запросов к источнику.'),{reason:'rate-limit'});
    }
    if (!response.ok || Number(response.headers?.get('content-length'))>2_500_000) {
      throw Object.assign(new Error('Выпуск Росстата недоступен.'),{reason:'provider-error'});
    }
    return response.json();
  }

  function once(key,load) {
    if (inFlight.has(key)) return inFlight.get(key);
    const request = load().finally(()=>inFlight.delete(key));
    inFlight.set(key,request);
    return request;
  }

  async function discover(metric) {
    if (edition) return {id:'sr-mes-sub-'+edition+'-'+metricInfo[metric].key,edition:'SR_mes_sub_'+edition};
    const cached = editions.get(metric);
    if (cached?.expires>now()) return cached.value;
    const {query,prefix} = metrics[metric];
    const published = await fetchJson('catalog',{q:query,limit:'30'});
    const pattern = new RegExp('^sr-mes-sub-(0[1-9]|1[0-2])-(20\\d{2})-'+prefix+'-v-(?:kollektivnyh-)?sredstvah(?:-[a-z0-9-]+)?$');
    const matches = (published.ok && Array.isArray(published.items) ? published.items : []).flatMap(item=>{
      const matched = typeof item.ds_id==='string' && pattern.exec(item.ds_id);
      return matched && item.workbook==='SR_mes_sub_'+matched[1]+'-'+matched[2]
        ? [{id:item.ds_id,edition:item.workbook,yearMonth:matched[2]+matched[1]}] : [];
    });
    const latest = matches.toSorted((a,b)=>b.yearMonth.localeCompare(a.yearMonth))[0];
    if (!latest) throw Object.assign(new Error('Нет совместимого месячного выпуска.'),{reason:'missing-workbook'});
    editions.set(metric,{value:latest,expires:now()+refreshPeriod});
    return latest;
  }

  async function download(ref,area) {
    const query = area ? {q:area.name,limit:'30'} : undefined;
    const response = await fetchJson('dataset/'+ref.id,query);
    const data = response.dataset;
    if (!response.ok || data?.workbook!==ref.edition || !Array.isArray(data.series) || data.series.length>2500 ||
        !Array.isArray(data.periods) || !data.periods.length || data.periods.length>50 ||
        !data.periods.every(value=>/^20\d{2}$/.test(value)) || new Set(data.periods.map(String)).size!==data.periods.length) {
      throw Object.assign(new Error('Неверный формат месячного выпуска.'),{reason:'malformed-workbook'});
    }
    const rowCount = Number(data.series_total ?? response.series_total ?? response.total);
    return {id:ref.id,edition:ref.edition,source:'https://roschart.ru/dataset/'+ref.id,
      periods:data.periods,series:data.series,complete:rowCount>0 ? rowCount<=data.series.length : data.series.length>=900};
  }

  async function acquire(metric,area) {
    const workbook = await once(metric,async()=>{
      const cached = workbooks.get(metric);
      if (cached?.expires>now()) return cached.status==='error' ? cached : {...cached,status:'cached'};
      try {
        const value = await download(await discover(metric));
        const updated = {value,checkedAt:now(),expires:now()+refreshPeriod,status:'live'};
        workbooks.set(metric,updated);
        return updated;
      } catch (error) {
        const failed = {...cached,expires:now()+retryPeriod,status:'error',reason:error.reason ?? 'provider-error'};
        workbooks.set(metric,failed);
        return failed;
      }
    });
    if (!workbook.value) return workbook;
    const found = seriesForRegion(workbook.value,metric,area,timestamp(workbook.checkedAt));
    if (found || workbook.value.complete) return {...workbook,series:found};

    const key = workbook.value.id+'|'+area.id;
    // Some provider plans paginate the unfiltered workbook. The exact-name fallback stays bounded.
    return once(key,async()=>{
      const cached = scoped.get(key);
      if (cached?.expires>now()) return cached.status==='error' ? cached : {...cached,status:'cached'};
      let record;
      try {
        const value = await download(workbook.value,area);
        const checkedAt = now();
        record = {value,series:seriesForRegion(value,metric,area,timestamp(checkedAt)),checkedAt,expires:checkedAt+refreshPeriod,status:'live'};
      } catch (error) {
        record = {...cached,value:cached?.value ?? workbook.value,expires:now()+retryPeriod,status:'error',reason:error.reason ?? 'provider-error'};
      }
      scoped.delete(key);
      scoped.set(key,record);
      if (scoped.size>24) scoped.delete(scoped.keys().next().value);
      return record;
    });
  }

  async function get({regionId,metric,years=[],last=3}={}) {
    const {regionById} = await regionRegistry();
    const region = regionById.get(String(regionId));
    if (!region || !Object.hasOwn(metrics,metric)) throw invalidInput('Выберите субъект и показатель из списка.');
    if (!Array.isArray(years) || years.length>16 || years.some(year=>!Number.isInteger(year) || year<2000 || year>2099) ||
        !Number.isInteger(last) || last<1 || last>5) throw invalidInput('Укажите годы сравнения или от одного до пяти последних полных лет.');
    const result = await acquire(metric,region);
    const {series,checkedAt} = result;
    const requestedYears = years.length ? [...new Set(years)].sort((a,b)=>a-b) :
      series?.years.filter(row=>row.total!==null).slice(-last).map(row=>row.year) ?? [];
    const summary = series && requestedYears.length ? statSummary(series,requestedYears) : null;
    const coveredYears = summary?.years.filter(year=>year.monthly.some(Number.isFinite)).map(year=>year.year) ?? [];
    const straddlesRevision = coveredYears.some(year=>year<2026) && coveredYears.some(year=>year>=2026);
    const sources = [
      {title:'Росстат',url:officialStatistics,checkedAt:series?.checkedAt ?? null},
      {title:'Roschart',url:result.value?.source ?? catalogueUrl,checkedAt:series?.checkedAt ?? null},
    ];
    if (straddlesRevision) sources.push({title:'Методология Росстата',url:methodologyChange.source,checkedAt:null});
    const unavailable = !coveredYears.length;
    return {region:{...region},metric,summary:unavailable ? null : {...summary,...(straddlesRevision ? {methodologyChange} : {})},
      requestedYears,sources,sourceCheckedAt:checkedAt === undefined ? null : timestamp(checkedAt),
      sourceStatus:result.status==='error' ? 'error' : unavailable ? 'unavailable' : result.status,
      ...(result.reason ? {reason:result.reason} : unavailable ? {reason:series ? 'missing-period' : 'missing-region'} : {}),
      ...(blockedUntil>now() ? {retryAt:timestamp(blockedUntil)} : {}),
    };
  }

  return {get};
}
