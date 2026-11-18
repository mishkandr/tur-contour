import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const timeoutMs = 6500;
const intervalMs = 60_000;
const recentLimit = 60;
const providerUrls = {
  wikipedia:'https://ru.wikipedia.org/w/api.php?action=query&format=json&meta=siteinfo&siprop=general',
  weather:'https://api.open-meteo.com/v1/forecast?latitude=55.7558&longitude=37.6176&daily=weather_code&forecast_days=1',
  statistics:'https://roschart.ru/api/catalog?limit=1',
};
const validResponses = {
  wikipedia:data=>Boolean(data.query?.general),
  weather:data=>Array.isArray(data.daily?.weather_code),
  statistics:data=>data.ok===true && Array.isArray(data.items),
};

const catalogFailures = new Set(['timeout','network','format','partial']);

function bounded(entries) {
  const counts={probe:0,catalog:0};
  return entries.filter(entry=>counts[entry.operation]++<recentLimit);
}

export function createSourceMonitor(stateDirectory,{fetchImpl=globalThis.fetch,now=Date.now,statisticsKey,overpassUrl,overpassEuropeUrl}={}) {
  const file=join(stateDirectory,'source-checks.json');
  const mapProviders={
    openstreetmap:overpassUrl ?? 'https://overpass.private.coffee/api/interpreter',
    ...(overpassEuropeUrl ? {'openstreetmap-europe':overpassEuropeUrl} : {}),
  };
  const providers=[...Object.keys(mapProviders),...Object.keys(providerUrls)];
  const catalogProviders=[...Object.keys(mapProviders),'wikipedia'];
  const pending=new Map();
  let writes=Promise.resolve();
  let journal;
  async function history() {
    journal ??= readFile(file,'utf8').then(JSON.parse).then(entries=>Array.isArray(entries)
      ? bounded(entries.filter(entry=>providers.includes(entry?.id)&&['ok','empty','error'].includes(entry.status)&&
        Number.isFinite(Date.parse(entry.checkedAt))).map(entry=>({...entry,operation:entry.operation==='catalog'?'catalog':'probe'})))
      : []).catch(()=>[]);
    return journal;
  }
  async function status() {
    const entries=await history();
    const recent=(ids,operation)=>Object.fromEntries(ids.flatMap(id=>{
      const entry=entries.find(item=>item.id===id && item.operation===operation);
      return entry ? [[id,entry]] : [];
    }));
    return {providers,latest:recent(providers,'probe'),loads:recent(catalogProviders,'catalog'),
      errors:entries.filter(entry=>entry.status==='error').slice(0,15)};
  }
  function persist(entries) {
    const payload=JSON.stringify(entries);
    writes=writes.then(async()=>{
      const temporary=file+'-'+randomUUID();
      try {
        await mkdir(stateDirectory,{recursive:true});
        await writeFile(temporary,payload,{mode:0o600,flag:'wx'});
        await rename(temporary,file);
      } catch { await unlink(temporary).catch(()=>{}); }
    });
    return writes;
  }
  async function record(entry) {
    const entries=await history();
    entries.unshift({...entry,checkedAt:new Date(now()).toISOString()});
    const keep=bounded(entries);
    entries.splice(0,entries.length,...keep);
    await persist(entries);
  }
  async function recordCatalog({id,detail,count,durationMs}) {
    if (!catalogProviders.includes(id)) return;
    const failure=catalogFailures.has(detail) || /^HTTP [1-5]\d{2}$/u.test(detail ?? '') ? detail :
      Number.isSafeInteger(count) && count>=0 ? null : 'format';
    await record({id,operation:'catalog',status:failure?'error':count?'ok':'empty',detail:failure,
      durationMs:Number.isFinite(durationMs)?Math.max(0,Math.round(durationMs)):0,
      count:failure?null:count});
  }
  async function probe(id) {
    const started=now();
    const signal=AbortSignal.timeout(timeoutMs);
    let outcome='ok';
    let detail=null;
    try {
      const isMapProvider=Object.hasOwn(mapProviders,id);
      const url=isMapProvider ? new URL('status',mapProviders[id]) : providerUrls[id];
      const headers={'User-Agent':'TourContour/1.0 (https://github.com/mishkandr/tur-contour)'};
      if (id==='statistics' && statisticsKey) headers['X-API-Key']=statisticsKey;
      const response=await fetchImpl(url,{headers,signal,redirect:'error'});
      if (!response.ok) {outcome='error';detail='HTTP '+response.status;}
      else if (isMapProvider) {
        const text=await response.text();
        if (!/Connected as|Current time|Rate limit/iu.test(text)) {outcome='error';detail='format';}
      } else if (!validResponses[id](await response.json())) {
        outcome='error';detail='format';
      }
    } catch {
      outcome='error';
      detail=signal.aborted?'timeout':'network';
    }
    await record({id,operation:'probe',status:outcome,detail,durationMs:Math.max(0,now()-started)});
    return status();
  }
  async function check(id) {
    if (!providers.includes(id)) throw Object.assign(Error('Неизвестный источник.'),{status:400});
    const entries=await history();
    if (pending.has(id)) return pending.get(id);
    const previous=entries.find(entry=>entry.id===id && entry.operation==='probe');
    if (previous && now()-Date.parse(previous.checkedAt)<intervalMs) return status();
    const task=probe(id).finally(()=>pending.delete(id));
    pending.set(id,task);
    return task;
  }
  return {status,check,recordCatalog};
}
