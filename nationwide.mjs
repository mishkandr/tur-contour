import { readFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';

const loadJson = file => readFile(new URL('./data/'+file,import.meta.url),'utf8').then(JSON.parse);
const geonames = 'https://www.geonames.org/';
const osm = {
  id:'openstreetmap', name:'OpenStreetMap', url:'https://www.openstreetmap.org/copyright',
  license:'ODbL', provider:'Overpass API',
};
const wiki = {id:'wikimedia',name:'Википедия',url:'https://www.mediawiki.org/wiki/API:Geosearch',license:'CC BY-SA 4.0',provider:'MediaWiki GeoSearch'};
const fallbackUrl = 'https://overpass.private.coffee/api/interpreter';
const cache = new Map();
const pending = new Map();
const citySearchCache = new Map();
const hour = 3_600_000;
let registry;
let citySearchNames;
let snapshots;
let blockedUntil = 0;
let overpassCooldownUntil = 0;
let requestInProgress = false;

const themes = new Set(['heritage','museum','any','romantic','family','hike','nature','craft','pilgrimage']);
const traditionalCrafts=['pottery','glassblower','weaver','basket_maker','sculptor','blacksmith','woodcarver','handicraft'];
const transportModes = {
  walking:{ radius:2.8, leg:2.6, speed:4, delay:5 },
  mixed:{ radius:6.5, leg:6, speed:15, delay:12 },
  car:{ radius:10.5, leg:9, speed:24, delay:15 },
};
const paceModes = {
  relaxed:{ visits:2, starts:600, duration:80 },
  normal:{ visits:3, starts:570, duration:65 },
  dense:{ visits:4, starts:540, duration:55 },
};
const pilotCityNames=new Set(['Владимир','Суздаль','Кидекша','Муром','Гусь-Хрустальный','Боголюбово','Александров']);
const categories={museum:['museum','heritage'],heritage:['heritage'],park:['nature','hike','family','romantic'],
  family:['family'],craft:['craft'],pilgrimage:['heritage','pilgrimage'],stay:['accommodation'],food:['dining']};

function clean(value, limit = 160) {
  return typeof value==='string' ? value.replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,limit) : '';
}

function normalize(value) {
  return clean(value,4000).toLowerCase().replaceAll('ё','е').normalize('NFC').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

async function cityData() {
  registry ??= loadJson('russia-cities.json').then(data => {
    const byId = new Map(data.cities.map(row=>[String(row[0]),row]));
    return {...data,byId};
  });
  return registry;
}

function formatCity(row, regions) {
  const [id,name,en,cn,lat,lon,population,regionCode,timezone] = row;
  const [region,regionEn,regionCn] = regions[regionCode] ?? [];
  return { id:String(id),name,en,cn,region:region ?? null,regionEn:regionEn ?? null,regionCn:regionCn ?? null,
    population:population || null,coordinates:[lat,lon],timezone,sourceUrl:geonames+id+'/' };
}

export async function listCities(input = '') {
  const data = await cityData();
  const query = normalize(clean(typeof input==='string' ? input : input?.query,100));
  if (!query) return {cities:data.cities.slice(0,24).map(row=>formatCity(row,data.regions)),source:data.source,total:data.cities.length};
  const cached=citySearchCache.get(query);
  if (cached) {
    citySearchCache.delete(query);
    citySearchCache.set(query,cached);
    return cached;
  }
  citySearchNames ??= data.cities.map(row=>row.slice(1,4).filter(Boolean).map(normalize));
  const buckets = [[],[],[],[]];
  const terms = query.split(' ');
  for (const [index,row] of data.cities.entries()) {
    const names = citySearchNames[index];
    let rank = -1;
    if (names.includes(query)) rank=0;
    else if (names.some(name=>(' '+name+' ').includes(' '+query+' '))) rank=1;
    else if (names.some(name=>name.startsWith(query) || name.split(' ').some(part=>part.startsWith(query)))) rank=2;
    else if (terms.length===1 && names.some(name=>name.includes(query))) rank=3;
    else if (terms.length>1 && terms.some(term=>names.some(name=>name.includes(term)))) {
      const context = [...names,...(data.regions[row[7]] ?? []).filter(Boolean).map(normalize)].join(' ');
      if (terms.every(term=>context.includes(term))) rank=3;
    }
    if (rank>=0 && buckets[rank].length<24) buckets[rank].push(row);
    if (buckets[0].length===24) break;
  }
  const result={cities:buckets.flat().slice(0,24).map(row=>formatCity(row,data.regions)),source:data.source,total:data.cities.length};
  citySearchCache.set(query,result);
  if (citySearchCache.size>80) citySearchCache.delete(citySearchCache.keys().next().value);
  return result;
}

function russianNouns(word) {
  if (word.endsWith('а')) return [word.slice(0,-1)+'е',word.slice(0,-1)+'ы',word.slice(0,-1)+'у'];
  if (/[яьй]$/.test(word)) return ['е','и','я','ю'].map(ending=>word.slice(0,-1)+ending);
  if (word.endsWith('ец')) return ['ца','це','цу'].map(ending=>word.slice(0,-2)+ending);
  if (/[цкнгдвсртлмпфхбжшщзч]$/.test(word)) return ['а','е','у','ом'].map(ending=>word+ending);
  return [];
}

function russianVariants(name) {
  const words=normalize(name).split(' ');
  const tail=words.at(-1);
  if (!tail || !/^[а-я]+$/.test(tail)) return [];
  const prefixes=words.slice(0,-1);
  const adjectives = {
    'нижний':['нижнего','нижнем','нижнему'], 'великий':['великого','великом','великому'],
    'старый':['старого','старом','старому'], 'новый':['нового','новом','новому'],
    'верхний':['верхнего','верхнем','верхнему'], 'южно':['южно'],
  };
  const forms=russianNouns(tail).map(word=>[...prefixes,word].join(' '));
  if (words.length===2 && Object.hasOwn(adjectives,words[0])) {
    for (const first of adjectives[words[0]]) {
      for (const last of russianNouns(tail)) forms.push(first+' '+last);
    }
  }
  const adjective = tail.match(/^(.*?)(ный|ской|ский)$/);
  if (adjective) {
    const [,,ending]=adjective;
    const cases = ending.startsWith('ск') ? ['ского','ском','скому'] : ['ного','ном','ному'];
    for (const suffix of cases) forms.push([...prefixes,adjective[1]+suffix].join(' '));
  }
  return forms;
}

export async function detectCities(brief) {
  const query=normalize(brief);
  if (!query) return [];
  const data=await cityData();
  const matchText=' '+query+' ';
  const found=[];
  for (const row of data.cities) {
    if (row[6]<40_000 && !pilotCityNames.has(row[1])) continue;
    const names=row.slice(1,4).filter(Boolean).map(normalize);
    const forms=[...new Set([...names,...russianVariants(row[1])])];
    const matched=forms.map(form=>({form,index:/^[\p{Script=Han}]+$/u.test(form) ? query.indexOf(form)+1 : matchText.indexOf(' '+form+' ')+1}))
      .filter(item=>item.index>0).sort((a,b)=>a.index-b.index || b.form.length-a.form.length)[0];
    if (matched) found.push({...matched,row});
  }
  found.sort((a,b)=>a.index-b.index || b.form.length-a.form.length || b.row[6]-a.row[6]);
  const result=[];
  let lastEnd=0;
  for (const item of found) {
    if (item.index<lastEnd) continue;
    lastEnd=item.index+item.form.length;
    result.push(formatCity(item.row,data.regions));
  }
  return result;
}

const error = message => Object.assign(new Error(message),{status:400});
const relativeDate = (date,offset) => new Date(Date.parse(date+'T12:00:00Z')+offset*86_400_000).toISOString().slice(0,10);

function description(value, maxParts, maxLength) {
  const values = Array.isArray(value) ? value : typeof value==='string' ? value.split(/[,;\n]+/) : [];
  return [...new Set(values.slice(0,maxParts).map(item=>clean(item,maxLength)).filter(item=>normalize(item)))];
}

function asCityId(value) {
  const id = typeof value==='number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof id==='string' && /^\d{1,12}$/.test(id) ? id : null;
}

function readSettings(input) {
  const cityId = asCityId(input.cityId);
  if (!cityId) throw error('Выберите населённый пункт из списка.');
  const date = typeof input.date==='string' ? input.date : '';
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || relativeDate(date,0)!==date) {
    throw error('Укажите корректную дату начала программы.');
  }
  const days = Number(input.days);
  if (![2,3].includes(days)) throw error('Выберите длительность 2 или 3 дня.');
  const additional = input.additionalCityIds ?? [];
  if (!Array.isArray(additional) || additional.length>2 || additional.some(value=>asCityId(value)===null)) {
    throw error('Выберите дополнительные населённые пункты из списка.');
  }
  const additionalCityIds = [...new Set(additional.map(asCityId))].filter(id=>id!==cityId);
  if (additionalCityIds.length>=days) throw error('На каждый населённый пункт нужен отдельный день.');
  const size = Number(input.size);
  if (!Number.isInteger(size) || size<1 || size>100) throw error('Размер группы должен быть от 1 до 100 человек.');
  const visitDeadline = typeof input.visitDeadline==='string' ? input.visitDeadline.trim() : '';
  if (input.visitDeadline!=null && typeof input.visitDeadline!=='string' ||
      visitDeadline && !/^(?:(?:09|1[0-7]):[0-5]\d|18:00)$/.test(visitDeadline)) {
    throw error('Укажите время окончания посещений между 09:00 и 18:00.');
  }
  const excludedInterests=[...new Set((Array.isArray(input.excludedInterests) ? input.excludedInterests : []).slice(0,9)
    .filter(value=>themes.has(value) && value!=='any'))];
  const omittedIds=[...new Set((Array.isArray(input.omittedIds) ? input.omittedIds : []).slice(0,32)
    .filter(id=>typeof id==='string' && /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u.test(id)))];
  const theme = themes.has(input.theme) && !excludedInterests.includes(input.theme) ? input.theme : 'any';
  const interests = [...new Set([theme,...description(input.interests,9,30)
    .filter(value=>themes.has(value) && !excludedInterests.includes(value))])];
  return { cityId,...(additionalCityIds.length ? {additionalCityIds} : {}),...(visitDeadline ? {visitDeadline} : {}),
    days,date,size,theme,interests,excludedInterests,...(omittedIds.length ? {omittedIds} : {}),market:input.market==='zh' ? 'zh' : 'ru',access:input.access===true,
    transport:Object.hasOwn(transportModes,input.transport) ? input.transport : 'mixed',
    pace:Object.hasOwn(paceModes,input.pace) ? input.pace : 'normal',
    keywords:description(input.keywords,12,90),required:description(input.required,10,100),demo:false };
}

function distance([a,b],[x,y]) {
  const radians = Math.PI/180;
  const latitude = Math.sin((a-x)*radians/2);
  const longitude = Math.sin((b-y)*radians/2);
  const angle = latitude**2+Math.cos(a*radians)*Math.cos(x*radians)*longitude**2;
  return 12742*Math.asin(Math.min(1,Math.sqrt(angle)));
}

function endpoint() {
  const url = new URL(process.env.TUR_OVERPASS_URL ?? fallbackUrl);
  if (!['http:','https:'].includes(url.protocol)) throw Error('Unsupported Overpass URL');
  return url;
}

function queryAround(city) {
  const [lat,lon] = city.coordinates;
  const around = kilometres=>'(around:'+kilometres+','+lat.toFixed(5)+','+lon.toFixed(5)+')[name]';
  const visit = around(11_000);
  const infrastructure = around(8500);
  return '[out:json][timeout:10];'+
    'nwr'+visit+'[tourism~"^(museum|gallery|zoo|aquarium|theme_park)$"];out center 55;'+
    'nwr'+visit+'[historic~"^(castle|fort|monument|memorial|archaeological_site)$"];out center 40;'+
    'nwr'+visit+'[tourism~"^(attraction|viewpoint)$"];out center 45;'+
    'nwr'+visit+'[leisure~"^(park|garden)$"];out center 34;'+
    'nwr'+visit+'[craft~"^('+traditionalCrafts.join('|')+')$"];out center 24;'+
    '(nwr'+visit+'[amenity=monastery];nwr'+visit+'[historic=monastery];nwr'+visit+'[building=monastery];nwr'+visit+'[pilgrimage=yes];);out center 24;'+
    'nwr'+infrastructure+'[amenity=restaurant];out center 42;'+
    'nwr'+infrastructure+'[tourism~"^(hotel|hostel|guest_house)$"];out center 30;';
}

function classify(tags) {
  if (tags.amenity==='restaurant') return {kind:'food',tags:['dining']};
  if (['hotel','hostel','guest_house'].includes(tags.tourism)) return {kind:'stay',tags:['accommodation']};
  const matches=[
    ['museum',['museum','gallery'].includes(tags.tourism)],
    ['family',['zoo','aquarium','theme_park'].includes(tags.tourism)],
    ['park',['park','garden'].includes(tags.leisure) || tags.tourism==='viewpoint'],
    ['heritage',['castle','fort','monument','memorial','archaeological_site'].includes(tags.historic)],
    ['craft',traditionalCrafts.includes(tags.craft)],
    ['pilgrimage',[tags.amenity,tags.historic,tags.building].includes('monastery') || tags.pilgrimage==='yes'],
  ];
  const interests=[...new Set(matches.flatMap(([category,match])=>match ? categories[category] : []))];
  return interests.length || tags.tourism==='attraction' ? {kind:'visit',tags:interests} : null;
}

function pointOf(element) {
  const [lat,lon] = [element.lat ?? element.center?.lat,element.lon ?? element.center?.lon];
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=85 && Math.abs(lon)<=180 ? [lat,lon] : null;
}

function fromOsm(elements,city) {
  const seen = new Set();
  const objects = [];
  for (const element of elements.slice(0,320)) {
    if (!element || !['node','way','relation'].includes(element.type) || !Number.isSafeInteger(element.id) || element.id<1) continue;
    const coordinates = pointOf(element);
    const tags = element.tags ?? {};
    const category = classify(tags);
    const name = clean(tags['name:ru'] ?? tags.name);
    const key = category?.kind+'|'+normalize(name);
    if (!coordinates || distance(coordinates,city.coordinates)>12 || !name || !category || seen.has(key)) continue;
    seen.add(key);
    objects.push({ id:'osm-'+element.type+'-'+element.id,name,en:clean(tags['name:en']) || null,
      cn:clean(tags['name:zh-Hans'] ?? tags['name:zh']) || null,city:city.name,coordinates,...category,status:'unknown',geoStatus:'mapped',
      url:'https://www.openstreetmap.org/'+element.type+'/'+element.id,officialUrl:webAddress(tags.website ?? tags['contact:website']),
      hoursHint:clean(tags.opening_hours,200) || null,wheelchairHint:clean(tags.wheelchair,15) || null });
  }
  return objects;
}

function webAddress(value) {
  if (typeof value!=='string' || value.length>500) return null;
  try {
    const url = new URL(value);
    return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

async function archivedPlaces(city,reason) {
  snapshots ??= loadJson('nationwide-pois.json').catch(error=>{
    if (error.code==='ENOENT') return {cities:{}};
    throw error;
  });
  const dataset = await snapshots;
  const local = dataset.cities[city.id];
  if (!local) return {places:[],source:{...osm,status:'unavailable',reason}};
  const places = local.elements ? fromOsm(local.elements,city) : local.places.flatMap(place=>{
    const tags = categories[place.category];
    const [lat,lon] = place.coordinates ?? [];
    if (!tags || !Number.isFinite(lat) || !Number.isFinite(lon) || distance([lat,lon],city.coordinates)>12) return [];
    const kind = ['stay','food'].includes(place.category) ? place.category : 'visit';
    return [{...place,city:city.name,kind,tags:kind==='visit' ? fallbackTags(place.name,tags) : tags,
      status:'unknown',geoStatus:'mapped'}];
  });
  return { places,source:{...(dataset.source ?? osm),status:'snapshot',checkedAt:local.checkedAt,reason} };
}

async function fetchOverpass(city,fetchImpl) {
  const shared = fetchImpl===globalThis.fetch;
  if (shared && overpassCooldownUntil>Date.now()) return null;
  function coolDown(delay) {
    if (shared) overpassCooldownUntil=Math.max(overpassCooldownUntil,Date.now()+delay);
    return null;
  }
  try {
    const url = endpoint();
    url.searchParams.set('data',queryAround(city));
    const response = await fetchImpl(url,{headers:{'User-Agent':'TourContour/1.0 (https://github.com/mishkandr/tur-contour)','Accept':'application/json'},
      signal:AbortSignal.timeout(7_000),redirect:'error'});
    if (response.status===429 || response.status===406) return coolDown(30_000);
    if (!response.ok || Number(response.headers?.get('content-length'))>2_000_000) return coolDown(120_000);
    const payload = await response.json();
    if (!Array.isArray(payload.elements) || payload.remark) return null;
    const places = fromOsm(payload.elements,city);
    return places.length ? { places,source:{...osm,status:'live',checkedAt:payload.osm3s?.timestamp_osm_base ?? null} } : null;
  } catch { return coolDown(120_000); }
}

function fallbackTags(label,tags = []) {
  const title=normalize(label);
  const additions=[];
  if (/(^| )(монастырь|монастырское подворье|обитель)( |$)/.test(title)) additions.push('pilgrimage','heritage');
  if (/(^| )(гончарная|стеклодувная|ткацкая|ремесленная) мастерская( |$)/.test(title) ||
      /(^| )(музей|центр|дом) (народных промыслов|народного искусства|ремесел|хрусталя|керамики|лаковой миниатюры)( |$)/.test(title)) additions.push('craft');
  return [...new Set([...tags,...additions])];
}

function categoryOfWikiPage(page) {
  const title=normalize(page.title);
  if (/(^| )(ресторан|кафе|столовая|отель|гостиница|гостиничный)( |$)/.test(title)) return null;
  if (/(^| )(музей|галерея)( |$)/.test(title)) return 'museum';
  if (/(^| )(океанариум|зоопарк|зооботанический|дельфинарий)( |$)/.test(title)) return 'family';
  if (/(^| )(парк|сад|набережная|сквер|дендрарий|мыс|озеро|сопка|водопад)( |$)/.test(title)) return 'park';
  if (/(^| )(собор|башня|храм|мечеть|крепость|кремль|усадьба|маяк|дворец|площадь|театр|памятник|монастырь|особняк|церковь|дом)( |$)/.test(title)) return 'heritage';
  return fallbackTags(title)[0] ?? null;
}

async function fetchWikiPois(city,fetchImpl) {
  try {
    const endpoint = new URL('https://ru.wikipedia.org/w/api.php');
    endpoint.search=new URLSearchParams({action:'query',list:'geosearch',gscoord:city.coordinates.join('|'),
      gsradius:'9500',gslimit:'100',gsnamespace:'0',format:'json',formatversion:'2'});
    const response=await fetchImpl(endpoint,{headers:{'User-Agent':'TourContour/1.0 (https://github.com/mishkandr/tur-contour)','Accept':'application/json'},
      signal:AbortSignal.timeout(5500),redirect:'error'});
    if (!response.ok) return null;
    const result=await response.json();
    if (!Array.isArray(result.query?.geosearch)) return null;
    const places=result.query.geosearch.slice(0,100).flatMap(page=>{
      const point=pointOf(page);
      const category=categoryOfWikiPage(page);
      const name=clean(page.title);
      if (!point || !category || !name || !Number.isSafeInteger(page.pageid) || page.pageid<1 ||
        distance(point,city.coordinates)>10 || normalize(name)===normalize(city.name)) return [];
      const kind = ['stay','food'].includes(category) ? category : 'visit';
      return [{id:'ruwiki-'+page.pageid,name,city:city.name,coordinates:point,kind,tags:fallbackTags(name,categories[category]),status:'unknown',geoStatus:'mapped',
        url:'https://ru.wikipedia.org/?curid='+page.pageid}];
    });
    return places.length ? {places,source:{...wiki,status:'live',checkedAt:new Date().toISOString()}} : null;
  } catch { return null; }
}

async function requestPois(city,fetchImpl) {
  const live = await fetchOverpass(city,fetchImpl) ?? await fetchWikiPois(city,fetchImpl);
  if (!live) return archivedPlaces(city,'provider-error');
  const kinds = new Set(live.places.map(place=>place.kind));
  const saved = await archivedPlaces(city,'supplemental-catalog');
  const places = [...live.places];
  let usedArchive=false;
  for (const archived of saved.places) {
    const index=places.findIndex(place=>sameSite(place,archived));
    if (index>=0) {
      const place=places[index];
      const aliases=[...new Set([...(place.aliases ?? []),archived.name,archived.en,archived.cn].filter(Boolean))];
      const sources=[...new Set([...(place.sources ?? [place.url]),archived.url])];
      places[index]={...place,en:place.en ?? archived.en,cn:place.cn ?? archived.cn,aliases,sources,
        tags:[...new Set([...place.tags,...archived.tags])]};
      usedArchive=true;
    } else if (archived.kind==='visit' || !kinds.has(archived.kind)) {
      places.push(archived);
      usedArchive=true;
    }
  }
  return {places,source:usedArchive ? {...live.source,supplemental:saved.source} : live.source};
}

function sameSite(place,archived) {
  if (place.kind!==archived.kind) return false;
  const gap=distance(place.coordinates,archived.coordinates);
  if (gap>0.18) return false;
  return searchable(place).some(name=>searchable(archived).some(savedName=>{
    if (name===savedName) return true;
    const [short,long]=name.length<=savedName.length ? [name,savedName] : [savedName,name];
    return gap<0.045 && short.length>4 && (' '+long+' ').includes(' '+short+' ');
  }));
}

async function objectsFor(city,fetchImpl) {
  if (process.env.TUR_NO_OVERPASS==='1') return archivedPlaces(city,'disabled');
  if (fetchImpl!==globalThis.fetch) return requestPois(city,fetchImpl);
  const memo = cache.get(city.id);
  if (memo?.until>Date.now()) {
    cache.delete(city.id);
    cache.set(city.id,memo);
    return memo.result;
  }
  if (pending.has(city.id)) return pending.get(city.id);
  if (blockedUntil>Date.now() || requestInProgress) return archivedPlaces(city,'busy');
  requestInProgress = true;
  blockedUntil = Date.now()+2000;
  const task = requestPois(city,fetchImpl).then(result=>{
    cache.set(city.id,{until:Date.now()+(result.source.status==='live' ? 18*hour : 180_000),result});
    if (cache.size>80) cache.delete(cache.keys().next().value);
    return result;
  }).finally(()=>{
    requestInProgress=false;
    pending.delete(city.id);
  });
  pending.set(city.id,task);
  return task;
}

function searchable(place) {
  return [place.name,place.en,place.cn,...(place.aliases ?? [])].filter(Boolean).map(normalize);
}

function matchRequired(required,points) {
  return required.map(label=>{
    const name = normalize(label);
    const exact = points.find(place=>searchable(place).includes(name));
    const partial = points.filter(place=>name.length>3 && searchable(place).some(word=>word.includes(name)));
    return { label,place:exact ?? (partial.length===1 ? partial[0] : null) };
  });
}

function fitScore(place,settings) {
  const terms = searchable(place).join(' ');
  const keywords = settings.keywords.map(normalize).filter(word=>word.length>1);
  const themesScore = settings.interests.filter(interest=>place.tags.includes(interest)).length;
  return themesScore*4+keywords.filter(word=>terms.includes(word)).length*6+Number(settings.access && place.wheelchairHint==='yes');
}

const excludedThemes=(place,settings)=>place?.kind==='visit'
  ? settings.excludedInterests.filter(theme=>place.tags.includes(theme)) : [];
const accessBlocked=(place,settings)=>settings.access && place?.wheelchairHint==='no';

const time = minutes => [Math.floor(minutes/60),minutes%60].map(part=>String(part).padStart(2,'0')).join(':');

function schedule(contexts,settings) {
  const mode=transportModes[settings.transport];
  const pace=paceModes[settings.pace];
  const eligible=context=>context.places.filter(place=>distance(place.coordinates,context.location.coordinates)<=mode.radius);
  const scopes=contexts.map(context=>({location:context.location,candidates:eligible(context)}));
  const required=matchRequired(settings.required,scopes.flatMap(scope=>scope.candidates));
  const requested=new Set(required.flatMap(item=>item.place?.id ?? []));
  const allScheduled=new Set();
  const days=[];
  const coverage=new Map(settings.interests.filter(theme=>theme!=='any').map(theme=>[theme,0]));
  const omitted=new Set(settings.omittedIds);
  const dayEnd=17*60+45;
  const [deadlineHour,deadlineMinute]=settings.visitDeadline?.split(':').map(Number) ?? [18,0];
  const visitEnd=Math.min(dayEnd,deadlineHour*60+deadlineMinute);

  for (let day=0; day<settings.days; day+=1) {
    const {location,candidates}=scopes[Math.min(day,scopes.length-1)];
    const allowed=candidates.filter(place=>!omitted.has(place.id) && !excludedThemes(place,settings).length && !accessBlocked(place,settings));
    const stops=[],missing=[];
    const changedCity=day>0 && day<scopes.length;
    const from=changedCity ? scopes[day-1].location : null;
    const transfer=from ? {from:from.name,to:location.name,fromId:from.id,toId:location.id,
      distanceKm:Math.round(distance(from.coordinates,location.coordinates)*10)/10,distanceType:'straight-line',
      status:'unknown',transport:settings.transport} : null;
    if (transfer) {
      missing.push(`Согласовать переезд ${transfer.from} → ${transfer.to}. ${transfer.distanceKm} км по прямой. Проверьте транспорт и время прибытия.`);
    }
    let position=location.coordinates;
    let cursor=pace.starts;
    function find(kind,duration,earliest = 0,latest = kind==='visit' ? visitEnd : dayEnd) {
      const eligible=allowed.flatMap(place=>{
        if (place.kind!==kind || (kind==='visit' && allScheduled.has(place.id))) return [];
        const km=distance(position,place.coordinates);
        if (km>mode.leg) return [];
        const estimatedTransfer=km<0.08 ? 0 : 5*Math.ceil((km/mode.speed*60+mode.delay)/5);
        const start=Math.max(earliest,cursor+estimatedTransfer);
        const end=start+duration;
        if (end>latest) return [];
        const remainingPriority=requested.has(place.id) && !allScheduled.has(place.id) ? 40 : 0;
        const uncovered=place.tags.filter(theme=>coverage.get(theme)===0).length;
        const score=remainingPriority+fitScore(place,settings)+uncovered*8-km*2;
        return [{place,score,start,end,estimatedTransfer}];
      });
      return eligible.sort((a,b)=>b.score-a.score || a.place.id.localeCompare(b.place.id))[0];
    }
    function add(candidate) {
      if (!candidate) return false;
      const {place,start,end,estimatedTransfer}=candidate;
      stops.push({id:place.id,type:place.kind,name:place.name,en:place.en,cn:place.cn,coordinates:place.coordinates,url:place.url,
        start:time(start),end:time(end),estimatedTransfer,status:'unknown',geoStatus:place.geoStatus});
      allScheduled.add(place.id);
      if (place.kind==='visit') {
        for (const interest of place.tags) if (coverage.has(interest)) coverage.set(interest,coverage.get(interest)+1);
      }
      position=place.coordinates;
      cursor=end+10;
      return true;
    }
    let visitCount=Number(add(find('visit',pace.duration)));
    let deadlineReached=!visitCount && visitEnd<dayEnd && Boolean(find('visit',pace.duration,0,dayEnd));
    if (settings.visitDeadline) {
      while (visitCount<pace.visits && add(find('visit',pace.duration,0,Math.min(12*60,visitEnd)))) visitCount++;
    }
    if (!add(find('food',50,12*60))) missing.push('Подобрать и согласовать обед для группы.');
    while (visitCount<pace.visits) {
      if (!add(find('visit',pace.duration))) {
        deadlineReached ||= visitEnd<dayEnd && Boolean(find('visit',pace.duration,0,dayEnd));
        break;
      }
      visitCount++;
    }
    if (deadlineReached) missing.push(`Часть посещений не помещается до ${settings.visitDeadline}. Уточните время или уменьшите число остановок.`);
    else if (!visitCount) missing.push('Подобрать первую точку посещения.');
    else if (visitCount===1) missing.push('Подобрать вторую точку посещения.');
    if (day<settings.days-1 && !add(find('stay',30,15*60))) missing.push('Подобрать и согласовать размещение группы.');
    days.push({city:location.name,cityId:location.id,date:relativeDate(settings.date,day),stops,missing,...(transfer ? {transfer} : {})});
  }

  const requiredResult=required.map(({label,place})=>{
    const excludedInterests=excludedThemes(place,settings);
    return {label,matched:place ? {id:place.id,name:place.name} : null,scheduled:Boolean(place && allScheduled.has(place.id)),
      ...(excludedInterests.length ? {excludedInterests} : {}),...(omitted.has(place?.id) ? {omitted:true} : {}),
      ...(accessBlocked(place,settings) ? {accessBlocked:true} : {})};
  });
  return {days,required:requiredResult,interestCoverage:[...coverage].map(([theme,count])=>({theme,count}))};
}

function mapData(locations,places,sources) {
  const latitude=locations.map(city=>city.coordinates[0]);
  const longitude=locations.map(city=>city.coordinates[1]);
  const credits = new Map(sources.flatMap(source=>[source,source.supplemental].filter(item=>item?.id!==osm.id && item?.name && item?.url)
    .map(item=>[item.id,{label:item.name,url:item.url}])));
  return {
    cities:Object.fromEntries(locations.map(city=>[city.name,{coordinates:city.coordinates,source:city.sourceUrl,en:city.en,cn:city.cn}])),
    places:Object.fromEntries(places.map(place=>[place.id,{coordinates:place.coordinates,source:place.url}])),
    bounds:[[Math.min(...latitude)-0.035,Math.max(-180,Math.min(...longitude)-0.05)],
      [Math.max(...latitude)+0.035,Math.min(180,Math.max(...longitude)+0.05)]],
    connections:[],
    attribution:[{label:'GeoNames',url:'https://www.geonames.org/export/'},{label:'OpenStreetMap contributors',url:osm.url},
      ...credits.values()],
  };
}

export async function draftItinerary(input = {}, {fetchImpl = globalThis.fetch} = {}) {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw error('Укажите параметры программы.');
  const settings=readSettings(input);
  const data=await cityData();
  const locations=[settings.cityId,...(settings.additionalCityIds ?? [])].map(id=>{
    const row=data.byId.get(id);
    if (!row) throw error('Населённый пункт не найден в GeoNames.');
    return formatCity(row,data.regions);
  });
  const contexts=[];
  for (const location of locations) {
    const interval=blockedUntil-Date.now();
    if (contexts.length && fetchImpl===globalThis.fetch && interval>0 && interval<=2000) await wait(interval+5);
    const {places,source}=await objectsFor(location,fetchImpl);
    contexts.push({location,places,source});
  }
  const omitted=new Set(settings.omittedIds);
  const places=[...new Map(contexts.flatMap(context=>context.places).map(place=>[place.id,place])).values()]
    .filter(place=>!omitted.has(place.id) && !excludedThemes(place,settings).length && !accessBlocked(place,settings));
  const sources=contexts.map(({location,source})=>({cityId:location.id,city:location.name,...source}));
  const {days,required,interestCoverage}=schedule(contexts,settings);
  const location=locations[0];
  const source=contexts[0].source;
  const warnings=['Время остановок и переездов ориентировочное. Для группы нужно подтвердить график, вместимость, питание, размещение и запись.'];
  if (contexts.some(context=>!context.places.length)) warnings.push('Для части выбранных территорий картографический источник не вернул объекты.');
  if (contexts.some(context=>context.source.status==='snapshot')) warnings.push('Используется сохранённая выборка точек.');
  if (locations.length>1) warnings.push('Указана прямая дистанция между городами. Время выезда и прибытия согласуйте отдельно.');
  if (settings.access) warnings.push('Доступность входов, туалетов и перемещений между точками требует отдельной проверки.');
  if (settings.market==='zh') warnings.push('Китайскоязычное сопровождение, перевод и питание для группы необходимо подтвердить.');
  return {location,locations,settings,plan:{settings,days,required,interestCoverage,completeness:false,assumptions:warnings},places,
    geodata:mapData(locations,places,sources),source,sources,warnings};
}
