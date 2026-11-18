import { readFile } from 'node:fs/promises';
import { setTimeout as wait } from 'node:timers/promises';
import { catalogRefreshMs, catalogVersion, maxCatalogPlaces, readCatalog, saveCatalog } from './national-catalog.mjs';

const loadJson = file => readFile(new URL('./data/'+file,import.meta.url),'utf8').then(JSON.parse);
const geonames = 'https://www.geonames.org/';
const osm = {
  id:'openstreetmap', name:'OpenStreetMap', url:'https://www.openstreetmap.org/copyright',
  license:'ODbL', provider:'Overpass API',
};
const europeanOsm = {...osm,provider:'Overpass Europe (Geofabrik)'};
const europeLane = 'openstreetmap-europe';
const wiki = {id:'wikimedia',name:'Википедия',url:'https://www.mediawiki.org/wiki/API:Geosearch',license:'CC BY-SA 4.0',provider:'MediaWiki GeoSearch'};
const fallbackUrl = 'https://overpass.private.coffee/api/interpreter';
const wikiLimit = 250;
const providerSpacingMs = 2000;
const fallbackRefreshMs = 180_000;
const unavailableRefreshMs = 30_000;
const providerLanes = {
  [osm.id]:{active:false,nextRequestAt:0,cooldownUntil:0},
  [europeLane]:{active:false,nextRequestAt:0,cooldownUntil:0},
  [wiki.id]:{active:false,nextRequestAt:0,cooldownUntil:0},
};
const cache = new Map();
const pending = new Map();
const citySearchCache = new Map();
let registry;
let citySearchNames;
let snapshots;
let europeanBoundary;

const themes = new Set(['heritage','museum','any','romantic','family','hike','nature','craft','pilgrimage','gastro']);
const traditionalCrafts=['pottery','glassblower','weaver','basket_maker','sculptor','blacksmith','woodcarver','handicraft'];
const regionalCuisine = new Set(['regional','local','russian','tatar','bashkir','buryat','yakut','udmurt','chuvash','caucasian','siberian']);
const culinarySite = /(?:^| )(?:продовольственный|фермерский|рыбный|гастрономический) рынок(?: |$)|(?:^| )музей (?:чак чака|хлеба|кухни|сыра|шоколада)(?: |$)/u;
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
const smallerRegionalCapitals=new Set(['2127202','523392','6313621']);
const cityAliases = {
  '2013348':['符拉迪沃斯托克'], '2119441':['南萨哈林斯克','南萨哈林斯克市','南薩哈林斯克','南薩哈林斯克市'],
  '1486209':['叶卡捷琳堡','葉卡捷琳堡','Ekaterinburg'],
  '498817':['Saint Petersburg','St Petersburg'], '479561':['乌法'], '499099':['萨马拉'],
};
const citySearchForms = row=>[...row.slice(1,4),...(cityAliases[row[0]] ?? [])].filter(Boolean).map(normalize);
const categories={museum:['museum','heritage'],heritage:['heritage'],park:['nature','hike','family','romantic'],
  family:['family'],craft:['craft'],pilgrimage:['heritage','pilgrimage'],stay:['accommodation'],food:['dining'],gastro:['gastro']};

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
  const aliases=cityAliases[id] ?? [];
  const chinese=aliases.find(alias=>/^\p{Script=Han}+$/u.test(alias)) ?? cn;
  return { id:String(id),name,en,cn:chinese,region:region ?? null,regionEn:regionEn ?? null,regionCn:regionCn ?? null,
    ...(aliases.length ? {aliases:[...new Set([...aliases,cn].filter(Boolean))]} : {}),
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
  citySearchNames ??= data.cities.map(citySearchForms);
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

const excludedCityPrefix=/(?<!\p{L})(?:(?:не\s+(?:едем|поедем|ездим|заезжаем|заедем|посещаем|посетим|планируем\s+ехать)|не\s+нужно\s+(?:ехать|заезжать)|без|исключая|вместо|пропустить)\s+(?:(?:в|во|из|через)\s+)?|(?:skip|exclude|without|instead\s+of|not\s+(?:visiting|going\s+to|in|via|through))\s+(?:the\s+city\s+of\s+)?)$|(?:不去|不经过|不途经|不参观|别去|不要去|不在|跳过|排除)\s*$/u;
const excludedCitySuffix=/^\s+(?:не\s+(?:едем|поедем|заезжаем|заедем|посещаем|посетим|рассматриваем)|(?:is\s+)?(?:excluded|off\s+the\s+itinerary))(?!\p{L})|^\s*(?:不去|不经过|不途经|不参观)/u;

function firstCityUse(query,matchText,form) {
  const isHan=/^\p{Script=Han}+$/u.test(form);
  const text=isHan ? query : matchText;
  const pattern=isHan ? form : ' '+form+' ';
  let index=text.indexOf(pattern);
  while (index>=0 && (excludedCityPrefix.test(query.slice(Math.max(0,index-80),index)) ||
      excludedCitySuffix.test(query.slice(index+form.length,index+form.length+50)))) {
    index=text.indexOf(pattern,index+1);
  }
  return index+1;
}

export async function detectCities(brief) {
  const query=clean(brief,4000).split(/(?<!\bst)[.!?;。！？；](?!\d)/iu).map(normalize).filter(Boolean).join(' | ');
  if (!query) return [];
  const data=await cityData();
  const matchText=' '+query+' ';
  const found=[];
  for (const row of data.cities) {
    if (row[6]<40_000 && !pilotCityNames.has(row[1]) && !smallerRegionalCapitals.has(String(row[0]))) continue;
    const forms=[...new Set([...citySearchForms(row),...russianVariants(row[1])])];
    const matched=forms.map(form=>({form,index:firstCityUse(query,matchText,form)}))
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

const isPlaceId=id=>typeof id==='string' && /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u.test(id);

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
  const omittedIds=[...new Set((Array.isArray(input.omittedIds) ? input.omittedIds : []).slice(0,32).filter(isPlaceId))];
  const selected=input.requiredPlaceIds ?? [];
  if (!Array.isArray(selected) || selected.length>10 || selected.some(id=>!isPlaceId(id))) {
    throw error('Выберите до 10 объектов из списка.');
  }
  const requiredPlaceIds=[...new Set(selected)];
  const replacements=input.replacements ?? [];
  if (!Array.isArray(replacements) || replacements.length>16 || replacements.some(change=>
    !change || !Number.isInteger(change.day) || change.day<0 || change.day>2 ||
    !isPlaceId(change.fromId) || !isPlaceId(change.toId) || change.fromId===change.toId)) {
    throw error('Укажите до 16 замен с номером дня и разными идентификаторами точек.');
  }
  const theme = themes.has(input.theme) && !excludedInterests.includes(input.theme) ? input.theme : 'any';
  const interests = [...new Set([theme,...description(input.interests,9,30)
    .filter(value=>themes.has(value) && !excludedInterests.includes(value))])];
  return { cityId,...(additionalCityIds.length ? {additionalCityIds} : {}),...(visitDeadline ? {visitDeadline} : {}),
    ...(replacements.length ? {replacements:replacements.map(({day,fromId,toId})=>({day,fromId,toId}))} : {}),
    ...(requiredPlaceIds.length ? {requiredPlaceIds} : {}),
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

function insideBoundary(lon,lat,boundary) {
  let inside=false;
  for (let index=1;index<boundary.length;index++) {
    const [a,firstLat]=boundary[index-1];
    const [b,secondLat]=boundary[index];
    if ((firstLat>lat)!==(secondLat>lat) && lon<a+(b-a)*(lat-firstLat)/(secondLat-firstLat)) inside=!inside;
  }
  return inside;
}

async function overpassTarget(city) {
  const regionalUrl=process.env.TUR_OVERPASS_EUROPE_URL;
  if (regionalUrl && providerLanes[europeLane].cooldownUntil<=Date.now()) {
    europeanBoundary ??= loadJson('geofabrik-europe-boundary.json').then(data=>data.boundary).catch(()=>[]);
    const boundary=await europeanBoundary;
    const [lat,lon]=city.coordinates;
    const latitudeRadius=4.5/111.2;
    const longitudeRadius=latitudeRadius/Math.cos(lat*Math.PI/180);
    const south=lat-latitudeRadius, north=lat+latitudeRadius, west=lon-longitudeRadius, east=lon+longitudeRadius;
    if ([south,lat,north].every(y=>[west,lon,east].every(x=>insideBoundary(x,y,boundary)))) {
      const bounds=[south,west,north,east].map(value=>value.toFixed(5)).join(',');
      return {url:regionalUrl,lane:europeLane,source:europeanOsm,bounds};
    }
  }
  return {url:process.env.TUR_OVERPASS_URL ?? fallbackUrl,lane:osm.id,source:osm};
}

function queryAround(city,bounds) {
  const [lat,lon] = city.coordinates;
  const around = kilometres=>(bounds ? '' : '(around:'+kilometres+','+lat.toFixed(5)+','+lon.toFixed(5)+')')+'[name]';
  const output = limit=>';out center '+(bounds ? 'qt ' : '')+limit+';';
  const visit = around(11_000);
  const infrastructure = around(10_500);
  return (bounds?'[out:json][timeout:6][bbox:'+bounds+'];':'[out:json][timeout:10];')+
    'nwr'+visit+'[tourism~"^(museum|gallery|zoo|aquarium|theme_park)$"]'+output(70)+
    'nwr'+visit+'[historic~"^(castle|fort|monument|memorial|archaeological_site)$"]'+output(50)+
    'nwr'+visit+'[tourism~"^(attraction|viewpoint)$"]'+output(55)+
    'nwr'+visit+'[leisure~"^(park|garden)$"]'+output(42)+
    'nwr'+visit+'[craft~"^('+traditionalCrafts.join('|')+')$"]'+output(24)+
    '(nwr'+visit+'[amenity=monastery];nwr'+visit+'[historic=monastery];nwr'+visit+'[building=monastery];nwr'+visit+'[pilgrimage=yes];)'+output(24)+
    'nwr'+infrastructure+'[amenity=restaurant]'+output(65)+
    'nwr'+infrastructure+'[amenity=cafe]'+output(30)+
    'nwr'+visit+'[amenity=marketplace]'+output(20)+
    'nwr'+infrastructure+'[tourism~"^(hotel|hostel|guest_house)$"]'+output(50);
}

function classify(tags) {
  if (['restaurant','cafe'].includes(tags.amenity)) {
    const cuisineHint=clean(tags.cuisine,100);
    const culinary=cuisineHint.toLowerCase().split(';').some(value=>regionalCuisine.has(value.trim()));
    return {kind:'food',tags:culinary?['dining','gastro']:['dining'],...(culinary?{cuisineHint}:{})};
  }
  if (['hotel','hostel','guest_house'].includes(tags.tourism)) return {kind:'stay',tags:['accommodation']};
  if (tags.amenity==='marketplace' && (['food','farmers_market','fish'].includes(tags.marketplace) ||
      culinarySite.test(normalize(tags['name:ru'] ?? tags.name)))) return {kind:'visit',tags:['gastro']};
  const matches=[
    ['museum',['museum','gallery'].includes(tags.tourism)],
    ['family',['zoo','aquarium','theme_park'].includes(tags.tourism)],
    ['park',['park','garden'].includes(tags.leisure) || tags.tourism==='viewpoint'],
    ['heritage',['castle','fort','monument','memorial','archaeological_site'].includes(tags.historic)],
    ['craft',traditionalCrafts.includes(tags.craft)],
    ['pilgrimage',[tags.amenity,tags.historic,tags.building].includes('monastery') || tags.pilgrimage==='yes'],
    ['gastro',culinarySite.test(normalize(tags['name:ru'] ?? tags.name))],
  ];
  const interests=[...new Set(matches.flatMap(([category,match])=>match ? categories[category] : []))];
  return interests.length || tags.tourism==='attraction' ? {kind:'visit',tags:interests} : null;
}

function exposureOf(name,category,tags={}) {
  if (tags.indoor==='yes') return 'indoors';
  const label = normalize(name);
  if (tags.indoor==='no' || category==='park' || /открытым небом|деревянного зодчества/u.test(label)) return 'outdoors';
  if (category==='museum' && !/музей заповедник|музей усадьба/u.test(label)) return 'indoors';
}

function pointOf(element) {
  const [lat,lon] = [element.lat ?? element.center?.lat,element.lon ?? element.center?.lon];
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat)<=85 && Math.abs(lon)<=180 ? [lat,lon] : null;
}

function fromOsm(elements,city) {
  const seen = new Map();
  const objects = [];
  for (const element of elements.slice(0,maxCatalogPlaces)) {
    if (!element || !['node','way','relation'].includes(element.type) || !Number.isSafeInteger(element.id) || element.id<1) continue;
    const coordinates = pointOf(element);
    const tags = element.tags ?? {};
    const category = classify(tags);
    const name = clean(tags['name:ru'] ?? tags.name);
    const key = category?.kind+'|'+normalize(name);
    const nearby=seen.get(key) ?? [];
    if (!coordinates || distance(coordinates,city.coordinates)>12 || !name || !category ||
        nearby.some(point=>distance(point,coordinates)<0.1)) continue;
    seen.set(key,[...nearby,coordinates]);
    const exposure = category.kind==='visit' ? exposureOf(name,
      category.tags.includes('nature') ? 'park' : category.tags.includes('museum') ? 'museum' : null,tags) : null;
    const street=clean(tags['addr:street:ru'] ?? tags['addr:street'],120);
    const address=clean(tags['addr:full'],160) || (street ? [street,clean(tags['addr:housenumber'],25)].filter(Boolean).join(', ') : null);
    objects.push({ id:'osm-'+element.type+'-'+element.id,name,en:clean(tags['name:en']) || null,
      cn:clean(tags['name:zh-Hans'] ?? tags['name:zh']) || null,city:city.name,coordinates,...category,status:'unknown',geoStatus:'mapped',
      ...(exposure ? {exposure} : {}),
      ...(address ? {address} : {}),
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
    const exposure = exposureOf(place.name,place.category);
    const documentedTags=place.gastro===true ? [...new Set([...tags,'gastro'])] : tags;
    return [{...place,city:city.name,kind,tags:kind==='visit' ? fallbackTags(place.name,documentedTags) : documentedTags,
      ...(exposure ? {exposure} : {}),
      status:'unknown',geoStatus:'mapped'}];
  });
  return { places,source:{...(dataset.source ?? osm),status:'snapshot',checkedAt:local.checkedAt,reason} };
}

async function fetchOverpass(city,fetchImpl,target) {
  const shared = fetchImpl===globalThis.fetch;
  const signal=AbortSignal.timeout(7_000);
  function failed(detail,delay) {
    if (shared) providerLanes[target.lane].cooldownUntil=Date.now()+delay;
    return {detail};
  }
  try {
    const url = new URL(target.url);
    if (!['http:','https:'].includes(url.protocol)) throw Error('Unsupported Overpass URL');
    url.searchParams.set('data',queryAround(city,target.bounds));
    const response = await fetchImpl(url,{headers:{'User-Agent':'TourContour/1.0 (https://github.com/mishkandr/tur-contour)','Accept':'application/json'},
      signal,redirect:'error'});
    if (!response.ok) {
      const delay=response.status===429 || response.status===406 ? retryDelay(response) : 120_000;
      return failed('HTTP '+response.status,delay);
    }
    if (Number(response.headers?.get('content-length'))>2_000_000) return failed('format',120_000);
    const payload = await response.json();
    if (payload?.remark) return failed(/timed out|timeout/iu.test(payload.remark)?'timeout':'partial',30_000);
    if (!Array.isArray(payload?.elements)) return failed('format',30_000);
    const places = fromOsm(payload.elements,city);
    const catalog=places.length ? {places,source:{...target.source,status:'live',checkedAt:payload.osm3s?.timestamp_osm_base ?? null}} : null;
    return {catalog};
  } catch (error) { return failed(signal.aborted?'timeout':error instanceof SyntaxError?'format':'network',120_000); }
}

function fallbackTags(label,tags = []) {
  const title=normalize(label);
  const additions=[];
  if (/(^| )(монастырь|монастырское подворье|обитель)( |$)/.test(title)) additions.push('pilgrimage','heritage');
  if (/(^| )(гончарная|стеклодувная|ткацкая|ремесленная) мастерская( |$)/.test(title) ||
      /(^| )(музей|центр|дом) (народных промыслов|народного искусства|ремесел|хрусталя|керамики|лаковой миниатюры)( |$)/.test(title)) additions.push('craft');
  if (culinarySite.test(title)) additions.push('gastro');
  return [...new Set([...tags,...additions])];
}

function categoryOfWikiPage(page) {
  const title=normalize(page.title);
  if (/(?:^| )(?:ресторан|кафе|столовая|отель|гостиница|гостиничный)(?: |$)/u.test(title)) return null;
  if (culinarySite.test(title)) return 'gastro';
  if (/(^| )(музей|галерея)( |$)/.test(title)) return 'museum';
  if (/^(жилой|доходный) дом(?: |$)/u.test(title)) return null;
  if (/(?:^| )(?:станция|вокзал|метро|остановка|платформа|переход|жилой комплекс|торговый центр|администрация|здание администрации)(?: |$)/u.test(title)) return null;
  if (/(^| )(океанариум|зоопарк|зооботанический|дельфинарий)( |$)/.test(title)) return 'family';
  if (/(^| )(парк|сад|набережная|сквер|дендрарий|мыс|озеро|сопка|водопад)( |$)/.test(title)) return 'park';
  if (/(^| )(собор|башня|храм|мечеть|крепость|кремль|усадьба|маяк|дворец|площадь|театр|памятник|монастырь|особняк|церковь|дом)( |$)/.test(title)) return 'heritage';
  return fallbackTags(title)[0] ?? null;
}

async function fetchWikiPois(city,fetchImpl) {
  const signal=AbortSignal.timeout(5500);
  try {
    const endpoint = new URL('https://ru.wikipedia.org/w/api.php');
    endpoint.search=new URLSearchParams({action:'query',list:'geosearch',gscoord:city.coordinates.join('|'),
      gsradius:'10000',gslimit:String(wikiLimit),gsnamespace:'0',format:'json',formatversion:'2'});
    const response=await fetchImpl(endpoint,{headers:{'User-Agent':'TourContour/1.0 (https://github.com/mishkandr/tur-contour)','Accept':'application/json'},
      signal,redirect:'error'});
    if (response.status===429 && fetchImpl===globalThis.fetch) {
      providerLanes[wiki.id].cooldownUntil=Date.now()+retryDelay(response);
    }
    if (!response.ok) return {detail:'HTTP '+response.status};
    const result=await response.json();
    if (!Array.isArray(result?.query?.geosearch)) return {detail:'format'};
    const places=result.query.geosearch.slice(0,wikiLimit).flatMap(page=>{
      const point=pointOf(page);
      const category=categoryOfWikiPage(page);
      const name=clean(page.title);
      if (!point || !category || !name || !Number.isSafeInteger(page.pageid) || page.pageid<1 ||
        distance(point,city.coordinates)>10 || normalize(name)===normalize(city.name)) return [];
      const kind = 'visit';
      const exposure = exposureOf(name,category);
      return [{id:'ruwiki-'+page.pageid,name,city:city.name,coordinates:point,kind,tags:fallbackTags(name,categories[category]),status:'unknown',geoStatus:'mapped',
        ...(exposure ? {exposure} : {}),
        url:'https://ru.wikipedia.org/?curid='+page.pageid}];
    });
    const catalog=places.length ? {places,source:{...wiki,status:'live',checkedAt:new Date().toISOString()}} : null;
    return {catalog};
  } catch (error) { return {detail:signal.aborted?'timeout':error instanceof SyntaxError?'format':'network'}; }
}

function mergeCatalogPlaces(places,catalog,curated=false) {
  for (const archived of catalog.places) {
    const index=places.findIndex(place=>sameSite(place,archived,curated));
    if (index>=0) {
      const place=places[index];
      const id=curated && archived.kind!=='visit' ? archived.id : place.id;
      const aliases=[...new Set([...(place.aliases ?? []),archived.name,archived.en,archived.cn,...(archived.aliases ?? [])].filter(Boolean))];
      const sourceIds=[...new Set([place.id,archived.id,...(place.sourceIds ?? [])])].filter(sourceId=>sourceId!==id);
      const sources=[...new Set([...(place.sources ?? [place.url]),archived.url])];
      const exposure = place.exposure ?? archived.exposure;
      places[index]={...place,id,en:place.en ?? archived.en,cn:place.cn ?? archived.cn,aliases,sources,
        ...(place.address || archived.address ? {address:place.address || archived.address} : {}),
        ...(sourceIds.length ? {sourceIds} : {}),
        ...(exposure ? {exposure} : {}),
        ...(archived.gastro===true ? {gastro:true} : {}),
        ...(archived.geoUrl || (curated && archived.kind!=='visit' && !catalog.source.provider?.includes('Overpass')) ?
          {officialUrl:archived.officialUrl ?? archived.url,geoUrl:place.geoUrl ?? place.url} : {}),
        ...(archived.dailyWindow ? {dailyWindow:archived.dailyWindow} : {}),
        ...(archived.weeklyWindows ? {weeklyWindows:archived.weeklyWindows,closedDates:archived.closedDates} : {}),
        tags:[...new Set([...place.tags,...archived.tags])]};
    } else {
      places.push(archived);
    }
  }
}

async function retainedCatalogs(city) {
  const records=await Promise.all([osm,wiki].map(provider=>readCatalog(city.id,provider)));
  return records.filter(Boolean).map(record=>record.source.id===wiki.id
    ? {...record,places:record.places.filter(place=>categoryOfWikiPage({title:place.name}))}
    : record).filter(record=>record.places.length).sort((a,b)=>b.source.fetchedAt.localeCompare(a.source.fetchedAt));
}

async function combineCatalogs(city,live,retained,reason) {
  const primary=live ?? retained[0];
  if (!primary) return archivedPlaces(city,reason);
  const secondary=retained.filter(catalog=>catalog.source.id!==primary.source.id);
  const saved=await archivedPlaces(city,'supplemental-catalog');
  const places=[...primary.places];
  for (const catalog of secondary) mergeCatalogPlaces(places,catalog);
  mergeCatalogPlaces(places,saved,true);
  return {places,source:{...primary.source,...(!live || reason==='busy' ? {reason} : {}),
    ...(secondary.length ? {retained:secondary.map(({source})=>source)} : {}),
    ...(saved.places.length ? {supplemental:saved.source} : {})}};
}

function retryDelay(response) {
  const value=response.headers?.get('retry-after')?.trim();
  const delay=/^\d+$/u.test(value ?? '') ? Number(value)*1000 : Date.parse(value)-Date.now();
  return Number.isFinite(delay) ? Math.max(30_000,delay) : 30_000;
}

async function requestProvider(city,fetchImpl,laneKey,fetchCatalog,recordCatalog) {
  const lane=providerLanes[laneKey];
  const shared=fetchImpl===globalThis.fetch;
  if (shared) {
    const now=Date.now();
    if (lane.active || lane.nextRequestAt>now) return {busy:true};
    if (lane.cooldownUntil>now) return {};
    lane.active=true;
    lane.nextRequestAt=now+providerSpacingMs;
  }
  const start=performance.now();
  let result;
  try {
    result=await fetchCatalog(city,fetchImpl);
  } finally {
    if (shared) lane.active=false;
  }
  const {catalog,detail}=result;
  if (recordCatalog) {
    try {
      await recordCatalog({id:laneKey===wiki.id?'wikipedia':laneKey,detail,
        count:detail?null:(catalog?.places.length ?? 0),durationMs:performance.now()-start});
    } catch { /* Keep catalog results usable if the source journal cannot be written. */ }
  }
  return {catalog};
}

function freshCatalog({version,source}) {
  return version===catalogVersion && Date.now()-Date.parse(source.fetchedAt)<catalogRefreshMs;
}

async function requestPois(city,fetchImpl,recordCatalog,retained=[]) {
  const target=await overpassTarget(city);
  const mapped=await requestProvider(city,fetchImpl,target.lane,(area,request)=>fetchOverpass(area,request,target),recordCatalog);
  const freshWiki=retained.some(record=>record.source.id===wiki.id && freshCatalog(record));
  const fallback=mapped.catalog || freshWiki ? {} : await requestProvider(city,fetchImpl,wiki.id,fetchWikiPois,recordCatalog);
  const live=mapped.catalog ?? fallback.catalog;
  if (live && fetchImpl===globalThis.fetch) await saveCatalog(city.id,live);
  const reason=mapped.busy || fallback.busy ? 'busy' : freshWiki ? 'recent' : 'provider-error';
  return combineCatalogs(city,live,retained,reason);
}

function sameSite(place,archived,curated) {
  if (place.kind!==archived.kind) return false;
  if (place.id===archived.id) return true;
  const gap=distance(place.coordinates,archived.coordinates);
  if (curated && place.kind==='visit' && gap<=0.3 &&
      archived.aliases?.some(alias=>normalize(alias)===normalize(place.name))) return true;
  if (gap>0.18) return false;
  return searchable(place).some(name=>searchable(archived).some(savedName=>{
    if (name===savedName) return true;
    const [short,long]=name.length<=savedName.length ? [name,savedName] : [savedName,name];
    return gap<0.045 && short.length>4 && (' '+long+' ').includes(' '+short+' ');
  }));
}

async function lookupPois(city,fetchImpl,recordCatalog) {
  const retained=await retainedCatalogs(city);
  if (retained.some(record=>record.source.id===osm.id && freshCatalog(record))) {
    return combineCatalogs(city,null,retained,'recent');
  }
  return requestPois(city,fetchImpl,recordCatalog,retained);
}

async function objectsFor(city,fetchImpl,recordCatalog) {
  if (process.env.TUR_NO_OVERPASS==='1') return archivedPlaces(city,'disabled');
  if (fetchImpl!==globalThis.fetch) return requestPois(city,fetchImpl,recordCatalog);
  const memo = cache.get(city.id);
  if (memo?.until>Date.now()) {
    cache.delete(city.id);
    cache.set(city.id,memo);
    return memo.result;
  }
  if (pending.has(city.id)) return pending.get(city.id);
  const task = lookupPois(city,fetchImpl,recordCatalog).then(result=>{
    if (result.source.reason!=='busy') {
      const primaryRefresh=result.source.status==='live' && result.source.id===osm.id;
      const refresh=result.source.status==='unavailable' ? unavailableRefreshMs : primaryRefresh ? catalogRefreshMs : fallbackRefreshMs;
      cache.set(city.id,{until:Date.now()+refresh,result});
      if (cache.size>80) cache.delete(cache.keys().next().value);
    }
    return result;
  }).finally(()=>{
    pending.delete(city.id);
  });
  pending.set(city.id,task);
  return task;
}

function searchable(place) {
  return [place.name,place.en,place.cn,...(place.aliases ?? [])].filter(Boolean).map(normalize);
}

const matchesId=(place,id)=>place.id===id || place.sourceIds?.includes(id);
const isOmitted=(place,ids)=>ids.has(place.id) || place.sourceIds?.some(id=>ids.has(id));

function matchRequired(required,points,selectedIds) {
  const byId = new Map(points.map(place=>[place.id,place]));
  const exactSelections = (selectedIds ?? []).map(requestedId=>{
    const place=byId.get(requestedId) ?? points.find(candidate=>matchesId(candidate,requestedId)) ?? null;
    return {label:place?.name ?? requestedId,place,candidates:[],requestedId};
  });
  const names=required.map(label=>{
    const name = normalize(label);
    const exact = points.filter(place=>searchable(place).includes(name));
    const matches = exact.length ? exact : points.filter(place=>name.length>3 && searchable(place)
      .some(word=>(' '+word+' ').includes(' '+name+' ')));
    return {label,place:matches.length===1 ? matches[0] : null,candidates:matches.slice(0,4)};
  });
  const seen=new Set();
  return [...exactSelections,...names].filter(({place})=>{
    if (!place) return true;
    if (seen.has(place.id)) return false;
    seen.add(place.id);
    return true;
  });
}

function fitScore(place,settings) {
  const terms = searchable(place).join(' ');
  const keywords = settings.keywords.map(normalize).filter(word=>word.length>1);
  const themesScore = settings.interests.filter(interest=>place.tags.includes(interest)).length;
  const culinaryFit=settings.interests.includes('gastro') && place.tags.includes('gastro');
  return themesScore*4+Number(culinaryFit)*18+keywords.filter(word=>terms.includes(word)).length*6+Number(settings.access && place.wheelchairHint==='yes');
}

const venueUrl=place=>place.officialUrl ?? place.url;
const excludedThemes=(place,settings)=>place?.kind==='visit'
  ? settings.excludedInterests.filter(theme=>place.tags.includes(theme)) : [];
const accessBlocked=(place,settings)=>settings.access && place?.wheelchairHint==='no';

const time = minutes => [Math.floor(minutes/60),minutes%60].map(part=>String(part).padStart(2,'0')).join(':');
const turnaround=10;
const endOfDay=17*60+45;
const lunchWindow={start:12*60,end:14*60+45};
const maxDayStates=10;
const roadBuffer={departureTime:'08:00',assumedSpeedKmh:65,bufferMinutes:30};

function localClock(instant,timeZone) {
  const [date,time]=new Date(instant).toLocaleString('sv-SE',{timeZone,
    year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).split(' ');
  return {date,time};
}

function estimateRoadArrival(transfer,date,from,to,priorArrival) {
  if (transfer.transport!=='car' || !from.timezone || !to.timezone) return {timing:{status:'unconfirmed'},arrival:null};
  try {
    const {departureTime,assumedSpeedKmh,bufferMinutes}=roadBuffer;
    const desired=Date.parse(date+'T'+departureTime+':00Z');
    const local=localClock(desired,from.timezone);
    const offset=Date.parse(local.date+'T'+local.time+':00Z')-desired;
    const departure=Math.max(desired-offset,priorArrival ?? 0);
    const reserveMinutes=15*Math.ceil((transfer.distanceKm/assumedSpeedKmh*60+bufferMinutes)/15);
    const arrival=departure+reserveMinutes*60_000;
    const start=localClock(departure,from.timezone);
    const end=localClock(arrival,to.timezone);
    return {arrival,timing:{status:'estimated',reserveMinutes,assumedSpeedKmh,bufferMinutes,
      departureDate:start.date,departureTime:start.time,arrivalDate:end.date,arrivalTime:end.time}};
  } catch {
    return {timing:{status:'unconfirmed'},arrival:null};
  }
}

function estimateLeg(origin,destination,settings) {
  const km=distance(origin.coordinates,destination.coordinates);
  const travelMode=settings.transport==='mixed' && km<=1.2 ? 'walking' : settings.transport;
  const mode=transportModes[travelMode];
  const boarding=settings.size>=20 && travelMode!=='walking' ? 10 : 0;
  const minutes=km<0.08 ? 0 : 5*Math.ceil((km/mode.speed*60+mode.delay+boarding)/5);
  return {minutes,distanceKm:Math.round(km*100)/100,fromId:origin.id ?? null,mode:travelMode,estimate:'straight-line',
    inRange:km<=transportModes[settings.transport].leg};
}

function openingWindow(place,date) {
  if (place.closedDates?.includes(date.slice(5))) return [0,0];
  if (place.weeklyWindows) return place.weeklyWindows[new Date(date+'T00:00:00Z').getUTCDay()] ?? [0,0];
  return place.dailyWindow ?? [0,24*60];
}

const visitFormats=['gastro','craft','pilgrimage','nature','museum','family','heritage'];
const standardFocus=['heritage','museum','nature'];
const areaRadius=transport=>transport==='walking' ? 0.55 : 0.75;
const nearbyRadius=transport=>transport==='walking' ? 0.95 : 1.2;
const hasNearby=(place,places,radius)=>places.some(neighbor=>neighbor.id!==place.id &&
  distance(neighbor.coordinates,place.coordinates)<=radius);

function focusTopics(settings) {
  const specific=settings.interests.filter(theme=>theme!=='any');
  return specific.length ? specific : standardFocus.filter(theme=>!settings.excludedInterests.includes(theme));
}

function matchesFocus(place,theme) {
  return place.tags.includes(theme) && (place.kind==='visit' || (place.kind==='food' && theme==='gastro'));
}

function availableActivities({allowed,allScheduled,date,pace,startMinute,visitEnd}) {
  return allowed.filter(place=>{
    if (allScheduled.has(place.id)) return false;
    const [opens,closes]=openingWindow(place,date);
    return place.kind==='visit'
      ? Math.max(opens,startMinute)+pace.duration<=Math.min(closes,visitEnd)
      : place.kind==='food' && Math.max(opens,startMinute,lunchWindow.start)+50<=Math.min(closes,lunchWindow.end);
  });
}

function dayFocus(eligible,settings,usedFocus,newArea) {
  const radius=nearbyRadius(settings.transport);
  const candidates=focusTopics(settings).map(theme=>{
    const matches=eligible.filter(place=>matchesFocus(place,theme));
    const local=matches.filter(place=>newArea.has(place.id));
    return {theme,hasPair:matches.length>1,areaPair:local.some(place=>hasNearby(place,local,radius))};
  });
  candidates.sort((a,b)=>Number(b.hasPair)-Number(a.hasPair) ||
    Number(usedFocus.has(a.theme))-Number(usedFocus.has(b.theme)) || Number(b.areaPair)-Number(a.areaPair));
  return candidates[0]?.theme;
}

function newAreaVisits(eligible,settings,earlierVisits) {
  if (!earlierVisits.length) return new Set();
  const topics=settings.interests.filter(theme=>theme!=='any');
  const radius=areaRadius(settings.transport);
  const unvisited=eligible.filter(place=>place.kind==='visit' &&
    (!topics.length || topics.some(theme=>matchesFocus(place,theme))) &&
    earlierVisits.every(previous=>distance(previous.coordinates,place.coordinates)>radius));
  return new Set(unvisited.filter(place=>hasNearby(place,unvisited,nearbyRadius(settings.transport))).map(({id})=>id));
}

function supportedFocus(stops,settings,preferred) {
  const topics=focusTopics(settings);
  const candidates=[...new Set([preferred,...topics].filter(Boolean))];
  for (const theme of candidates) {
    const placeIds=stops.filter(({place})=>matchesFocus(place,theme)).map(({place})=>place.id);
    if (placeIds.length>1) return {theme,placeIds};
  }
}

function pickStops(context) {
  const {settings,pace,date,visitEnd,origin,allowed,allScheduled,requested,coverage,needsStay,
    startMinute,overnightEnd,focus,newArea}=context;
  const visit={kind:'visit',duration:pace.duration};
  const morningCount=visitEnd<=13*60 ? pace.visits : Math.ceil(pace.visits/2);
  const slots=[
    ...Array.from({length:morningCount},()=>({...visit,morning:true,earliest:pace.starts,latest:Math.min(12*60+20,visitEnd)})),
    {kind:'food',duration:50,earliest:lunchWindow.start,latest:lunchWindow.end},
    ...Array.from({length:pace.visits},()=>({...visit,earliest:13*60,latest:visitEnd})),
    ...(needsStay ? [{kind:'stay',duration:30,earliest:15*60,latest:overnightEnd}] : []),
  ];
  const grouped=new Map(['visit','food','stay'].map(kind=>[kind,allowed.filter(place=>place.kind===kind)]));
  const baseScores=new Map(allowed.map(place=>[place.id,fitScore(place,settings)]));
  const formats=new Map(grouped.get('visit').map(place=>[place.id,visitFormats.find(format=>place.tags.includes(format))]));
  const openingHours=new Map(allowed.map(place=>[place.id,openingWindow(place,date)]));
  let states=[{stops:[],score:0,visitCount:0,place:origin,cursor:startMinute}];

  for (const slot of slots) {
    const next=[];
    for (const path of states) {
      next.push(path);
      if (slot.kind==='visit' && path.visitCount>=pace.visits) continue;
      const visitAnchor=path.stops.find(stop=>stop.place.kind==='visit')?.place;
      const focusCount=focus ? path.stops.filter(({place})=>matchesFocus(place,focus)).length : 0;
      const candidates=grouped.get(slot.kind).flatMap(place=>{
        if (slot.kind==='visit' && (allScheduled.has(place.id) || path.stops.some(stop=>stop.place.id===place.id))) return [];
        const leg=estimateLeg(path.place,place,settings);
        const [opens,closes]=openingHours.get(place.id);
        const start=Math.max(slot.earliest,path.cursor+leg.minutes,opens);
        const overnight=slot.kind==='stay' && origin.id===place.id;
        const end=start+(overnight ? 15 : slot.duration);
        if (!leg.inRange || end>Math.min(slot.latest,closes)) return [];
        const mandatory=requested.has(place.id) && !allScheduled.has(place.id);
        const covered=place.tags.filter(theme=>coverage.get(theme)===0 &&
          !path.stops.some(stop=>stop.place.tags.includes(theme))).length;
        const repeatedLunch=slot.kind==='food' && allScheduled.has(place.id);
        const firstMorningVisit=slot.morning && path.visitCount===0;
        const format=formats.get(place.id);
        const newFormat=format && !path.stops.some(stop=>formats.get(stop.place.id)===format);
        const dedicatedFocus=focus && matchesFocus(place,focus);
        const newAreaVisit=newArea.has(place.id);
        const localVisit=slot.kind==='visit' && visitAnchor &&
          distance(visitAnchor.coordinates,place.coordinates)<=areaRadius(settings.transport);
        const score=Number(mandatory)*1000+(slot.kind==='visit' ? 35 : 115)+
          (baseScores.get(place.id) ?? 0)+covered*11+(dedicatedFocus?(newAreaVisit?12:6):0)+(newFormat?8:0)+
          (dedicatedFocus && focusCount===1 ? 13 : 0)+(newAreaVisit?12:0)+(localVisit?8:0)+
          Number(overnight)*32-Number(repeatedLunch)*22+(firstMorningVisit ? 18 : 0)-leg.minutes/(slot.kind==='food' ? 4 : 6);
        return [{place,start,end,leg,score,...(slot.kind==='stay' ? {action:overnight ? 'return' : 'check-in'} : {})}];
      }).sort((a,b)=>b.score-a.score || a.end-b.end || a.place.id.localeCompare(b.place.id));
      for (const selected of candidates.slice(0,Math.max(4,requested.size))) {
        next.push({stops:[...path.stops,selected],score:path.score+selected.score,place:selected.place,
          cursor:selected.end+turnaround,visitCount:path.visitCount+Number(slot.kind==='visit')});
      }
    }
    const paths=new Set();
    states=next.sort((a,b)=>b.score-a.score || a.cursor-b.cursor).filter(path=>{
      const key=path.stops.map(item=>item.place.id).join('|');
      if (paths.has(key)) return false;
      paths.add(key);
      return true;
    }).slice(0,maxDayStates);
  }
  return states[0];
}

function replacementLegs(place,stops,index,{settings,date,origin,startMinute}) {
  const current=stops[index];
  const previous=stops[index-1];
  const next=stops[index+1];
  const inbound=estimateLeg(previous?.place ?? origin,place,settings);
  const outbound=next ? estimateLeg(place,next.place,settings) : null;
  const earliest=previous ? previous.end+turnaround : startMinute;
  const [opens,closes]=openingWindow(place,date);
  if (!inbound.inRange || earliest+inbound.minutes>current.start || current.start<opens || current.end>closes ||
      (outbound && (!outbound.inRange || current.end+turnaround+outbound.minutes>next.start))) return null;
  return {inbound,outbound};
}

function alternativeStops(stops,index,context,scheduledIds) {
  const {settings,allowed,requested}=context;
  const selected=stops[index];
  if (requested.has(selected.place.id) || selected.place.kind==='stay') return [];
  const ranked=allowed.flatMap(place=>{
    if (place.kind!==selected.place.kind || scheduledIds.has(place.id) || requested.has(place.id)) return [];
    const legs=replacementLegs(place,stops,index,context);
    if (!legs) return [];
    const score=fitScore(place,settings)-(legs.inbound.minutes+(legs.outbound?.minutes ?? 0))/7;
    return [{place,score}];
  }).sort((a,b)=>b.score-a.score || a.place.id.localeCompare(b.place.id));
  const shortlist=ranked.slice(0,2);
  if (selected.place.exposure==='outdoors' && !shortlist.some(item=>item.place.exposure==='indoors')) {
    const covered=ranked.find(item=>item.place.exposure==='indoors');
    if (covered) shortlist.splice(1,1,covered);
  }
  return shortlist.map(({place})=>({id:place.id,name:place.name,en:place.en,cn:place.cn,url:venueUrl(place),status:'unknown',
    ...(place.exposure ? {exposure:place.exposure} : {}),...(place.tags.includes('gastro')?{gastro:true}:{})}));
}

function applyReplacement(days,change) {
  const rejected=reason=>({...change,status:'rejected',reason});
  const day=days[change.day];
  if (!day) return rejected('day-unavailable');
  const index=day.chosen.findIndex(stop=>matchesId(stop.place,change.fromId));
  const current=day.chosen[index];
  if (!current) return rejected('stop-unavailable');
  const {context}=day;
  if (context.requested.has(current.place.id)) return rejected('mandatory-stop');
  if (current.place.kind==='stay') return rejected('lodging-continuity');
  if (days.some(item=>item.chosen.some(stop=>matchesId(stop.place,change.toId)))) return rejected('already-used');
  const place=context.allowed.find(candidate=>matchesId(candidate,change.toId) && candidate.kind===current.place.kind);
  if (!place || context.requested.has(place.id)) return rejected('alternative-unavailable');
  const legs=replacementLegs(place,day.chosen,index,context);
  if (!legs) return rejected('transfer-conflict');
  day.chosen[index]={...current,place,leg:legs.inbound};
  if (legs.outbound) day.chosen[index+1].leg=legs.outbound;
  return {...change,status:'applied'};
}

function schedule(contexts,settings) {
  const mode=transportModes[settings.transport];
  const pace=paceModes[settings.pace];
  const eligible=(places,origin)=>places.filter(place=>distance(place.coordinates,origin.coordinates)<=mode.radius);
  const allCandidates=[...new Map(contexts.flatMap(context=>context.places).map(place=>[place.id,place])).values()];
  const required=matchRequired(settings.required,allCandidates,settings.requiredPlaceIds);
  const inScope=new Set();
  const requested=new Set(required.flatMap(item=>item.place?.id ?? []));
  const allScheduled=new Set();
  const usedFocus=new Set();
  const visitedByCity=new Map();
  const days=[];
  const coverage=new Map(settings.interests.filter(theme=>theme!=='any').map(theme=>[theme,0]));
  const omitted=new Set(settings.omittedIds);
  const [deadlineHour,deadlineMinute]=settings.visitDeadline?.split(':').map(Number) ?? [18,0];
  const visitEnd=Math.min(endOfDay,deadlineHour*60+deadlineMinute);
  let previousStay;
  let earliestArrival=null;

  for (let day=0; day<settings.days; day+=1) {
    const {location,places}=contexts[Math.min(day,contexts.length-1)];
    const date=relativeDate(settings.date,day);
    const missing=[];
    const changedCity=day>0 && day<contexts.length;
    const from=changedCity ? contexts[day-1].location : null;
    const transfer=from ? {from:from.name,to:location.name,fromId:from.id,toId:location.id,
      distanceKm:Math.round(distance(from.coordinates,location.coordinates)*10)/10,distanceType:'straight-line',
      status:'unknown',transport:settings.transport} : null;
    if (transfer) {
      const {timing,arrival}=estimateRoadArrival(transfer,date,from,location,earliestArrival);
      transfer.timing=timing;
      earliestArrival=arrival;
      missing.push(`Согласовать переезд ${transfer.from} → ${transfer.to}. ${transfer.distanceKm} км по прямой. Проверьте транспорт и время прибытия.`);
    }
    const arrival=earliestArrival==null ? null : localClock(earliestArrival,location.timezone);
    const arrivalAfterDay=Boolean(arrival && arrival.date>date);
    const arrivalMinute=arrival?.date===date ? Number(arrival.time.slice(0,2))*60+Number(arrival.time.slice(3)) : 0;
    const startMinute=arrivalAfterDay ? 24*60 : Math.max(pace.starts,arrivalMinute);
    const origin=!changedCity && previousStay ? previousStay : {coordinates:location.coordinates};
    const candidates=eligible(places,origin);
    for (const place of candidates) inScope.add(place.id);
    const allowed=candidates.filter(place=>!isOmitted(place,omitted) && !excludedThemes(place,settings).length && !accessBlocked(place,settings));
    const needsStay=day<settings.days-1;
    const overnightEnd=arrivalMinute ? 22*60 : endOfDay;
    const dayContext={settings,pace,date,visitEnd,origin,allowed,allScheduled,requested,coverage,needsStay,startMinute,overnightEnd};
    const activities=availableActivities(dayContext);
    const earlierVisits=visitedByCity.get(location.id) ?? [];
    dayContext.newArea=newAreaVisits(activities,settings,earlierVisits);
    dayContext.focus=dayFocus(activities,settings,usedFocus,dayContext.newArea);
    const chosen=pickStops(dayContext);
    const actualFocus=supportedFocus(chosen.stops,settings,dayContext.focus);
    if (actualFocus) usedFocus.add(actualFocus.theme);
    const fewerVisitsAfterArrival=startMinute>pace.starts && chosen.visitCount<
      pickStops({...dayContext,startMinute:pace.starts,overnightEnd:endOfDay}).visitCount;
    if (transfer?.timing.status==='estimated') {
      transfer.timing.visitsLimited=fewerVisitsAfterArrival;
      if (fewerVisitsAfterArrival) {
        const timed=new Set(chosen.stops.map(stop=>stop.place.id));
        transfer.candidates=allowed.filter(place=>place.kind==='visit' && !timed.has(place.id) && !allScheduled.has(place.id))
          .sort((a,b)=>Number(requested.has(b.id))-Number(requested.has(a.id)) || fitScore(b,settings)-fitScore(a,settings))
          .slice(0,3).map(place=>({id:place.id,name:place.name,en:place.en,cn:place.cn,url:venueUrl(place)}));
      }
    }
    if (arrivalAfterDay) missing.push('Расчётный переезд заканчивается после этой даты. Для посещений нужен дополнительный день или другой транспорт.');
    else if (fewerVisitsAfterArrival) missing.push('После расчётного прибытия остаётся меньше времени на посещения.');
    else if (visitEnd<endOfDay && chosen.visitCount<pace.visits && pickStops({...dayContext,visitEnd:endOfDay}).visitCount>chosen.visitCount) {
      missing.push(`Часть посещений не помещается до ${settings.visitDeadline}. Уточните время или уменьшите число остановок.`);
    } else if (!chosen.visitCount) missing.push('Подобрать первую точку посещения.');
    else if (chosen.visitCount===1) missing.push('Подобрать вторую точку посещения.');
    const lunch=chosen.stops.find(stop=>stop.place.kind==='food')?.place;
    const lastStay=chosen.stops.find(stop=>stop.place.kind==='stay');
    const overnight=lastStay?.place;
    if (!lunch) missing.push('Подобрать и согласовать обед для группы.');
    if (needsStay && !overnight) missing.push('Подобрать и согласовать размещение группы.');
    for (const {place} of chosen.stops) {
      if (place.kind==='visit') earlierVisits.push(place);
      if (!allScheduled.has(place.id)) {
        for (const interest of place.tags) if (coverage.has(interest) && (place.kind==='visit' || interest==='gastro')) {
          coverage.set(interest,coverage.get(interest)+1);
        }
      }
      allScheduled.add(place.id);
    }
    visitedByCity.set(location.id,earlierVisits);
    days.push({city:location.name,cityId:location.id,date,arrivalAfterDay,
      chosen:chosen.stops,context:{settings,date,origin,allowed,requested,startMinute,focus:dayContext.focus},
      missing,needsStay,...(transfer ? {transfer} : {})});
    previousStay=overnight;
  }

  const replacements=(settings.replacements ?? []).map(change=>applyReplacement(days,change));
  const scheduledPlaces=new Map(days.flatMap(day=>day.chosen.map(({place})=>[place.id,place])));
  const scheduledIds=new Set(scheduledPlaces.keys());
  const requiredResult=required.map(({label,place,candidates,requestedId})=>{
    const excludedInterests=excludedThemes(place,settings);
    const scheduled=Boolean(place && scheduledIds.has(place.id));
    const reason=scheduled ? null : !place ? (candidates.length ? 'ambiguous' : 'not-found') :
      isOmitted(place,omitted) ? 'omitted' : excludedInterests.length ? 'excluded-interest' : accessBlocked(place,settings) ? 'inaccessible' :
        !inScope.has(place.id) ? 'out-of-range' : 'no-slot';
    return {label,matched:place ? {id:place.id,name:place.name} : null,scheduled,
      ...(requestedId ? {requestedId} : {}),
      ...(reason ? {reason} : {}),...(reason==='ambiguous' ? {candidates:candidates.map(place=>({id:place.id,name:place.name,city:place.city}))} : {}),
      ...(excludedInterests.length ? {excludedInterests} : {}),...(omitted.has(place?.id) ? {omitted:true} : {}),
      ...(accessBlocked(place,settings) ? {accessBlocked:true} : {})};
  });
  const meals=new Set();
  const scheduledDays=days.map(({chosen,context,needsStay,arrivalAfterDay,...day})=>{
    const lunch=chosen.find(stop=>stop.place.kind==='food');
    const overnight=chosen.find(stop=>stop.place.kind==='stay');
    const originStayId=context.origin.id;
    const focus=supportedFocus(chosen,settings,context.focus);
    const logistics={arrivalPending:Boolean(day.transfer || arrivalAfterDay),...(arrivalAfterDay?{arrivalAfterDay:true}:{}),
      ...(originStayId ? {originStayId} : {}),
      lunch:lunch ? {status:'suggested',id:lunch.place.id,...(meals.has(lunch.place.id) ? {repeated:true} : {})} : {status:'missing'},
      overnight:overnight ? {status:'suggested',id:overnight.place.id,action:overnight.action} : {status:needsStay ? 'missing' : 'not-required'},
      estimatedTransferMinutes:chosen.reduce((sum,stop)=>sum+stop.leg.minutes,0)};
    if (lunch) meals.add(lunch.place.id);
    const stops=chosen.map(({place,start,end,leg,action},index)=>{
      const knownHours=place.weeklyWindows || place.dailyWindow;
      const [opens,closes]=knownHours ? openingWindow(place,day.date) : [];
      return {
        id:place.id,type:place.kind,name:place.name,en:place.en,cn:place.cn,coordinates:place.coordinates,url:venueUrl(place),
        start:time(start),end:time(end),estimatedTransfer:leg.minutes,status:'unknown',geoStatus:place.geoStatus,
        ...(action ? {action} : {}),
        ...(place.exposure ? {exposure:place.exposure} : {}),
        ...(place.tags.includes('gastro') ? {gastro:true,...(place.cuisineHint?{cuisineHint:place.cuisineHint}:{})} : {}),
        ...(place.dailyWindow ? {dailyWindow:place.dailyWindow} : {}),
        ...(knownHours ? {openingHours:{opens:time(opens),closes:time(closes)}} : {}),
        required:requested.has(place.id),leg:{minutes:leg.minutes,distanceKm:leg.distanceKm,fromId:leg.fromId,mode:leg.mode,estimate:leg.estimate},
        alternatives:alternativeStops(chosen,index,context,scheduledIds),
      };
    });
    return {...day,...(focus ? {focus} : {}),logistics,stops};
  });
  const interestCoverage=[...coverage.keys()].map(theme=>({theme,count:[...scheduledPlaces.values()].filter(place=>
    (place.kind==='visit' || theme==='gastro') && place.tags.includes(theme)).length}));
  return {days:scheduledDays,required:requiredResult,replacements,interestCoverage};
}

function mapData(locations,places,sources) {
  const latitude=locations.map(city=>city.coordinates[0]);
  const longitude=locations.map(city=>city.coordinates[1]);
  const credits = new Map(sources.flatMap(source=>[source,source.supplemental,...(source.retained ?? [])]
    .filter(item=>item?.id!==osm.id && item?.name && item?.url)
    .map(item=>[item.id,{label:item.name,url:item.url}])));
  return {
    cities:Object.fromEntries(locations.map(city=>[city.name,{coordinates:city.coordinates,source:city.sourceUrl,en:city.en,cn:city.cn}])),
    places:Object.fromEntries(places.map(place=>[place.id,{coordinates:place.coordinates,source:place.geoUrl ?? place.url}])),
    bounds:[[Math.min(...latitude)-0.035,Math.max(-180,Math.min(...longitude)-0.05)],
      [Math.max(...latitude)+0.035,Math.min(180,Math.max(...longitude)+0.05)]],
    connections:[],
    attribution:[{label:'GeoNames',url:'https://www.geonames.org/export/'},{label:'OpenStreetMap contributors',url:osm.url},
      ...credits.values()],
  };
}

export async function getCity(cityId) {
  if (!/^\d{1,12}$/u.test(cityId ?? '')) throw error('Выберите город из списка.');
  const {byId,regions}=await cityData();
  const row=byId.get(String(cityId));
  if (!row) throw Object.assign(new Error('Населённый пункт не найден в GeoNames.'),{status:404});
  return formatCity(row,regions);
}

async function catalogFor(city,{fetchImpl,local,recordCatalog}) {
  const {places:providerPlaces,source}=await objectsFor(city,fetchImpl,recordCatalog);
  const inArea=local?.places.filter(place=>place.city===city.name && distance(place.coordinates,city.coordinates)<=12) ?? [];
  if (!inArea.length) return {places:providerPlaces,source};
  const places=[...providerPlaces];
  mergeCatalogPlaces(places,{places:inArea,source:local.source},true);
  return {places,source:source.status==='unavailable' ? local.source :
    {...source,retained:[...(source.retained ?? []),local.source]}};
}

export async function cityCatalog(city,{fetchImpl=globalThis.fetch,local,include=true,recordCatalog}={}) {
  const counts={visit:0,food:0,stay:0};
  if (!include) return {places:[],geodata:mapData([city],[],[]),catalogSources:[],counts};
  const {places,source}=await catalogFor(city,{fetchImpl,local,recordCatalog});
  const sources=[source,source.supplemental,...(source.retained ?? [])].filter(Boolean)
    .map(({supplemental,retained,...evidence})=>evidence);
  for (const place of places) counts[place.kind]+=1;
  return {places,geodata:mapData([city],places,sources),catalogSources:sources,counts};
}

export async function draftItinerary(input = {}, {fetchImpl = globalThis.fetch,local,recordCatalog} = {}) {
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
    if (contexts.length && fetchImpl===globalThis.fetch) {
      const {lane:key}=await overpassTarget(location);
      const now=Date.now();
      const lane=[providerLanes[key],providerLanes[wiki.id]].find(item=>!item.active && item.cooldownUntil<=now);
      const interval=lane?.nextRequestAt-now;
      if (interval>0 && interval<=providerSpacingMs) await wait(interval+5);
    }
    const {places,source}=await catalogFor(location,{fetchImpl,local,recordCatalog});
    contexts.push({location,places,source});
  }
  const omitted=new Set(settings.omittedIds);
  const places=[...new Map(contexts.flatMap(context=>context.places).map(place=>[place.id,place])).values()]
    .filter(place=>!isOmitted(place,omitted) && !excludedThemes(place,settings).length && !accessBlocked(place,settings));
  const sources=contexts.map(({location,source})=>({cityId:location.id,city:location.name,...source}));
  const {days,required,replacements,interestCoverage}=schedule(contexts,settings);
  const location=locations[0];
  const source=contexts[0].source;
  const warnings=['Время остановок и переездов ориентировочное. Для группы нужно подтвердить график, вместимость, питание, размещение и запись.'];
  if (contexts.some(context=>!context.places.length)) warnings.push('Для части выбранных территорий картографический источник не вернул объекты.');
  if (contexts.some(context=>context.source.status==='snapshot')) warnings.push('Используется сохранённая выборка точек.');
  if (locations.length>1) warnings.push('Указана прямая дистанция между городами. Время выезда и прибытия согласуйте отдельно.');
  if (settings.access) warnings.push('Доступность входов, туалетов и перемещений между точками требует отдельной проверки.');
  if (settings.market==='zh') warnings.push('Китайскоязычное сопровождение, перевод и питание для группы необходимо подтвердить.');
  return {location,locations,settings,plan:{settings,days,required,replacements,interestCoverage,completeness:false,assumptions:warnings},places,
    geodata:mapData(locations,places,sources),source,sources,warnings};
}
