import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hour=3_600_000;
export const catalogRefreshMs=18*hour;
const retentionMs=30*24*hour;
const directoryName='national-catalog';
const defaultState=fileURLToPath(new URL('./.runtime/',import.meta.url));
const fileName=/^\d{1,12}-(?:openstreetmap|wikimedia)\.json$/;
const maxBytes=2_000_000;
let nextPrune=0;

const directory=()=>join(process.env.TUR_STATE_DIR || defaultState,directoryName);
const catalogFile=(cityId,provider)=>cityId+'-'+provider.id+'.json';
const savedDate=value=>typeof value==='string' && Number.isFinite(Date.parse(value)) ? value : null;

function validPlace(place,provider) {
  return place && typeof place.id==='string' &&
    place.id.startsWith(provider.id==='openstreetmap' ? 'osm-' : 'ruwiki-') &&
    typeof place.name==='string' && typeof place.url==='string' &&
    ['visit','food','stay'].includes(place.kind) && place.status==='unknown' &&
    Array.isArray(place.tags) && place.tags.every(tag=>typeof tag==='string') &&
    place.coordinates?.length===2 && Array.isArray(place.coordinates) && place.coordinates.every(Number.isFinite);
}

export async function readCatalog(cityId,provider) {
  const file=join(directory(),catalogFile(cityId,provider));
  try {
    if ((await stat(file)).size>maxBytes) return null;
    const {version,fetchedAt,checkedAt,places}=JSON.parse(await readFile(file,'utf8'));
    const age=Date.now()-Date.parse(fetchedAt);
    if (version!==1 || !Number.isFinite(age) || age<0 || age>=retentionMs ||
        !Array.isArray(places) || !places.length || places.length>320 ||
        !places.every(place=>validPlace(place,provider))) return null;
    return {places,source:{...provider,status:'snapshot',checkedAt:savedDate(checkedAt),fetchedAt}};
  } catch { return null; }
}

async function pruneCatalogs(dir,now) {
  if (now<nextPrune) return;
  nextPrune=now+24*hour;
  for (const entry of await readdir(dir)) {
    if (!fileName.test(entry)) continue;
    const file=join(dir,entry);
    try {
      if ((await stat(file)).mtimeMs<now-retentionMs) await unlink(file);
    } catch { /* Another process may have removed the same file. */ }
  }
}

export async function saveCatalog(cityId,{places,source}) {
  const dir=directory();
  const file=join(dir,catalogFile(cityId,source));
  const temporary=file+'.'+randomUUID()+'.tmp';
  try {
    await mkdir(dir,{recursive:true});
    const now=Date.now();
    const payload=JSON.stringify({version:1,fetchedAt:new Date(now).toISOString(),checkedAt:savedDate(source.checkedAt),places});
    if (Buffer.byteLength(payload)>maxBytes) return;
    await writeFile(temporary,payload,{mode:0o644,flag:'wx'});
    await rename(temporary,file);
    await pruneCatalogs(dir,now).catch(()=>{});
  } catch {
    await unlink(temporary).catch(()=>{});
  }
}
