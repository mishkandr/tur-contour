import { directionId, routeDirections, routeTheme, scheduleFor } from './route-directions.mjs';

export { routeDirections };

export const region = 'Владимирская область';
export const officialStatistics = 'https://rosstat.gov.ru/statistics/turizm';
const methodologyChange = {from:'2026-01',source:'https://rosstat.gov.ru/storage/mediabank/met168-08042026.pdf'};
export const metricInfo = {
  people: { name: 'Численность размещённых лиц', unit: 'чел.', key: 'chislennost-razmeschennyh-lic-v-sredstvah' },
  nights: { name: 'Число ночёвок в средствах размещения', unit: 'ночёвок', key: 'chislo-nochevok-v-sredstvah-razmescheniya' },
};
export const months = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
export const number = value => new Intl.NumberFormat('ru-RU').format(value);

export function normalizeStatistics(dataset, metric) {
  const regionRows = dataset.series.filter(row => row.row === region);
  const rows = new Map(regionRows.map(row => [row.col, row.values]));
  if (regionRows.length !== 12 || rows.size !== 12 || !dataset.periods.every(year => /^20\d{2}$/.test(year))) {
    throw new Error('В наборе не найдены 12 накопительных рядов по Владимирской области');
  }
  const years = dataset.periods.map((period, index) => {
    let previous = 0;
    const monthly = months.map((ending, i) => {
      const cumulative = rows.get(i ? 'январь-' + ending : ending)?.[index];
      const value = Number.isFinite(cumulative) && Number.isFinite(previous) && cumulative >= previous
        ? cumulative - previous : null;
      previous = cumulative;
      return value;
    });
    return { year: Number(period), monthly, total: monthly.every(Number.isFinite) ? previous : null };
  });
  return {
    metric, ...metricInfo[metric], years, checkedAt: new Date().toISOString(),
    source: dataset.source_url, publication: officialStatistics, edition: dataset.workbook,
  };
}

export function statSummary(series, years) {
  const selected = years.length ? series.years.filter(y => years.includes(y.year)) : series.years.filter(y => y.total !== null).slice(-3);
  const covered = selected.filter(year=>Number.isFinite(year.total) || year.monthly?.some(Number.isFinite));
  const revised = covered.some(year=>year.year>=2026);
  const mixedMethodology = revised && covered.some(year=>year.year<2026);
  const full = selected.filter(y => y.total !== null);
  const comparison = full.length ? full : selected;
  const averages = months.map((month, i) => {
    const values = comparison.map(y => y.monthly?.[i]).filter(Number.isFinite);
    return { month, value: !mixedMethodology && values.length === comparison.length && values.length ? Math.round(values.reduce((a,b) => a+b,0) / values.length) : null };
  });
  const lows = averages.filter(x => x.value !== null).sort((a,b) => a.value - b.value).slice(0,3);
  const latest = full.at(-1);
  const previous = full.at(-2);
  const summer = latest?.monthly?.slice(5,8).reduce((a,b) => a+b,0);
  return { ...series, years:selected, averages, lows, latest, methodologyChange:revised ? methodologyChange : null,
    mixedMethodology, summerShare:summer ? Math.round(summer * 100 / latest.total) : null,
    yoy:!mixedMethodology && latest && previous?.year===latest.year-1 && previous.total ? (latest.total / previous.total - 1) * 100 : null };
}

export const defaultRoute = { days:2, date:'2026-11-21', size:18, market:'zh', theme:'heritage', access:false, demo:true };
export const trackedRoutes = [
  { id:'group-cn', title:'Владимир → Суздаль', subtitle:'Группа из Китая', settings:defaultRoute },
  { id:'group-small', title:'Владимир → Суздаль', subtitle:'Малая группа', settings:{...defaultRoute, size:8, market:'ru'} },
];
const cities = ['Владимир','Суздаль','Кидекша'];
const exteriorVisits = new Set(['golden-gate']);
const shortHeritageVisits = new Set(['dmitrovsky','golden-gate','nativity','kideksha']);
export const kindNames = { visit:'Посещение', food:'Питание', stay:'Размещение' };
export const fieldNames = {
  capacity:'Лимит группы', language:'Сопровождение', hours:'Часы работы', off:'Выходные дни',
  seasons:'Сезонность', minutes:'Продолжительность визита', access:'Безбарьерный доступ',
  coordinates:'Координаты', wikiName:'Название в Wikidata', total:'Годовое значение',
};
export const clockTime = minutes => Math.trunc(minutes / 60).toString().padStart(2,'0') + ':' + (minutes % 60).toString().padStart(2,'0');
const clockMinutes = value => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};
const dateFor = (date, offset) => new Date(Date.parse(date+'T12:00:00Z') + offset*86400000);
const isoDate = date => date.toISOString().slice(0,10);
const seasonFor = month => month === 0 || month === 1 || month === 11 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'autumn';

export function routeSettings(input) {
  const date = /^20\d{2}-\d{2}-\d{2}$/.test(input.date) && Number.isFinite(Date.parse(input.date)) &&
    new Date(input.date).toISOString().slice(0,10) === input.date ? input.date : defaultRoute.date;
  const size = Number(input.size);
  const direction = directionId(input.direction);
  return {
    days:Number(input.days) === 3 ? 3 : 2, date,
    size:Number.isInteger(size) && size >= 1 && size <= 100 ? size : defaultRoute.size,
    market:input.market === 'ru' ? 'ru' : 'zh',
    theme:routeTheme(input.theme,direction),
    access:input.access === true, demo:input.demo !== false,
    ...(direction==='vladimir-suzdal' ? {} : {direction}),
  };
}

function conflictingNames(name,wikiName) {
  const canonical = value=>value.toLowerCase().replaceAll('ё','е').split(' — ')[0].trim();
  return typeof wikiName==='string' && Boolean(wikiName.trim()) && canonical(name)!==canonical(wikiName);
}

export function objectsFrom(catalog, state) {
  return catalog.map(place => {
    const wiki = state.wiki?.[place.qid];
    return { ...place, coordinates:wiki?.coordinates ?? null, wikiName:wiki?.wikiName ?? null,
      checkedAt:'2026-11-17', wikiCheckedAt:wiki?.checkedAt ?? null,
      conflict:conflictingNames(place.name,wiki?.wikiName),
      wikiLink:place.qid ? 'https://www.wikidata.org/wiki/' + place.qid : null,
      audit:state.audit?.objects?.[place.id] ?? null,
      publishedConditions:state.publishedConditions?.[place.id] ?? null,
      verifiedAudit:state.verifiedAudit?.objects?.[place.id] ?? null };
  });
}

export function conditionsFor(place, settings) {
  return settings.demo ? place.audit : place.verifiedAudit;
}

export function publishedHours(place, date, day = 0) {
  const schedule = place.publishedConditions?.schedule;
  if (!schedule) return null;
  const visit = dateFor(date,day);
  const dayKey = isoDate(visit);
  if (schedule.validFrom && dayKey < schedule.validFrom || schedule.validUntil && dayKey > schedule.validUntil) {
    return {...schedule,date:dayKey,windows:null};
  }
  const windows = schedule.overrides?.[dayKey] ?? schedule.weekly[visit.getUTCDay()];
  return {...schedule,date:dayKey,windows};
}

export function groupApplicationDeadline(place, visitDate) {
  const rule = place.publishedConditions?.booking;
  if (!rule?.advanceDays || !Number.isFinite(Date.parse(visitDate)) || visitDate<rule.validFrom || visitDate>rule.validUntil) return null;
  return {date:isoDate(dateFor(visitDate,-rule.advanceDays)),days:rule.advanceDays,url:rule.termsUrl};
}

export function assess(place, settings, day = 0) {
  if (place.conflict) return { status:'unknown',reasons:['Название в Wikidata отличается от названия в каталоге. Сверьте идентичность объекта.'] };
  const audit = conditionsFor(place, settings);
  const official = !settings.demo && publishedHours(place,settings.date,day);
  if (official?.windows?.length === 0) return {status:'blocked',reasons:['По опубликованному графику этот формат посещения недоступен на выбранную дату.']};
  const limit = !settings.demo && place.publishedConditions?.limits?.find(item=>item.max < settings.size);
  if (limit) return {status:'blocked',reasons:['Опубликованный лимит для этого посещения — '+limit.max+' чел.']};
  if (!audit) {
    const reasons = !settings.demo && place.publishedConditions ? [...place.publishedConditions.clarify] : [];
    if (official && !official.windows) reasons.unshift('Опубликованный график не покрывает выбранную дату. Уточните часы.');
    return {status:'unknown', reasons:reasons.length ? reasons : ['Нужны подтверждённые часы, условия записи и лимит группы.']};
  }
  const date = dateFor(settings.date, day);
  const visitDate = isoDate(date);
  if (!settings.demo && (!audit.validUntil || visitDate > audit.validUntil || visitDate < (audit.verifiedAt?.slice(0,10) ?? ''))) {
    return { status:'unknown', reasons:['Подтверждение условий не покрывает выбранную дату визита.'] };
  }
  const reasons = [];
  if (audit.capacity < settings.size) reasons.push('Лимит ' + audit.capacity + ' чел. для группы из ' + settings.size + '.');
  const schedule = settings.demo ? 'по учебному графику' : 'по подтверждённому графику';
  if (audit.off.includes(date.getUTCDay())) reasons.push('Выходной '+schedule+'.');
  if (!audit.seasons.includes('all') && !audit.seasons.includes(seasonFor(date.getUTCMonth()))) reasons.push('Объект вне сезона '+schedule+'.');
  if (settings.access && audit.access === false) reasons.push('Безбарьерный доступ недоступен.');
  if (official?.windows && !openingWindows(place,audit,settings,day).some(([open,close,entry])=>open<=entry && close-open>=audit.minutes)) {
    reasons.push('Длительность визита не помещается в подтверждённые часы и опубликованный график.');
  }
  if (reasons.length) return { status:'blocked', reasons };
  if (settings.market === 'zh' && audit.language !== 'interpreter') reasons.push('Работа с китайскоязычным переводчиком требует подтверждения.');
  if (settings.access && audit.access !== true) reasons.push('Безбарьерный доступ требует подтверждения.');
  return { status:reasons.length ? 'unknown' : 'ready', reasons };
}

export function findPublishedVenue(catalog, venue) {
  return catalog.get(venue.id) ?? (venue.sourceIds ?? []).map(id=>catalog.get(id)).find(Boolean);
}

export function verifyDraftStops(draft, catalog) {
  const venues = new Map(draft.places.map(place=>[place.id,place]));
  const settings = {...draft.settings,demo:false};
  return draft.plan.days.map((day,offset)=>day.stops.map(stop=>{
    const place = findPublishedVenue(catalog,venues.get(stop.id) ?? stop);
    const evidence = place?.publishedConditions;
    const hours = place && publishedHours(place,day.date);
    const assessment = place ? assess(place,settings,offset) : {
      status:'unknown',reasons:['Уточните условия приёма группы у объекта.'],
    };
    const audit = place?.verifiedAudit;
    const windows = audit && assessment.status==='ready' ? openingWindows(place,audit,settings,offset) :
      hours?.windows?.map(([open,close])=>[open,close,close-(hours.lastEntryMinutes ?? 0)]);
    const start = clockMinutes(stop.start);
    const end = clockMinutes(stop.end);
    const outsideHours = !place?.conflict && windows?.length && !windows.some(([open,close,lastEntry])=>
      open<=start && start<=lastEntry && end<=close);
    return {id:stop.id,status:outsideHours ? 'blocked' : assessment.status,
      reasons:[...(outsideHours ? ['Время остановки выходит за доступные часы или время последнего входа.'] : []), ...assessment.reasons],
      hours:hours ? {windows:hours.windows,lastEntryMinutes:hours.lastEntryMinutes,url:hours.url} : null,
      booking:evidence?.booking ?? null,deadline:place ? groupApplicationDeadline(place,day.date) : null,
      limits:evidence?.limits ?? [],notes:evidence?.notes ?? [],checkedAt:evidence?.checkedAt ?? null};
  }));
}

export function comparePublishedGroupServices(draft, catalog) {
  const size = draft.settings.size;
  const services = [...catalog.values()].filter(place=>place.publishedConditions?.groupServices?.length);
  return draft.plan.days.flatMap(day=>{
    const lunch = day.stops.find(stop=>stop.type==='food');
    const slotMinutes = lunch ? clockMinutes(lunch.end)-clockMinutes(lunch.start) : null;
    return services.filter(place=>place.city===day.city).flatMap(place=>place.publishedConditions.groupServices.map(service=>{
      const [min,max] = service.size;
      const sessions = Math.ceil(size/max);
      const smaller = Math.floor(size/sessions);
      const extra = size % sessions;
      const split = sessions>1 && smaller>=min ? {
        groups:Array.from({length:sessions},(_,index)=>smaller+Number(index<extra)),
        minutes:service.minutes.map(value=>value*sessions),
      } : null;
      return {date:day.date,slotMinutes,venue:{name:place.name,en:place.en,cn:place.cn},service,
        size,singleFits:size>=min && size<=max,split};
    }));
  });
}

function themeFit(place, theme) {
  if (place.kind !== 'visit') return 0;
  if (place.formats?.includes(theme)) return 2;
  if (theme === 'romantic') return Number(shortHeritageVisits.has(place.id) || place.id === 'suzdal-kremlin');
  if (theme === 'family') return Number(place.theme === 'museum');
  if (theme === 'hike' || theme === 'nature') return place.theme===theme ? 2 : Number(exteriorVisits.has(place.id));
  return Number(place.theme === theme);
}

function travelStop(name, cn, start, duration) {
  return { type:'travel', name, cn, start:clockTime(start), end:clockTime(start+duration) };
}

function regionalTransfer(leg,start = leg.start) {
  return {...travelStop(leg.name,leg.cn,start,leg.minutes),from:leg.from,to:leg.to,en:leg.en};
}

function openingWindows(place, audit, settings, day) {
  const verifiedOpen = Math.round(audit.hours[0] * 60);
  const closing = Math.round(audit.hours[1] * 60);
  const verifiedClose = settings.demo ? Math.min(18 * 60,closing) : closing;
  const official = !settings.demo && publishedHours(place,settings.date,day);
  if (!official?.windows) return [[verifiedOpen,verifiedClose,verifiedClose]];
  return official.windows.map(([open,close]) => [Math.max(verifiedOpen,open),Math.min(verifiedClose,close),
    Math.min(verifiedClose,close-(official.lastEntryMinutes ?? 0))]);
}

const visitDuration = (audit, split) => split ? audit.minutes * 2 + 15 : audit.minutes;
const estimatedDuration = {visit:60,food:60,stay:45};

function candidateFor(place, settings, day, splitId, includePublished = false) {
  const audit = conditionsFor(place, settings);
  const split = Boolean(settings.demo && place.kind === 'visit' && place.id === splitId &&
    audit?.capacity < settings.size && audit.capacity * 2 >= settings.size);
  const group = split ? {...settings, size:Math.ceil(settings.size/2)} : settings;
  const assessment = assess(place,group,day);
  const fit = themeFit(place,settings.theme);
  if (assessment.status==='ready') return {place,audit,split,windows:openingWindows(place,audit,settings,day),fit};
  if (!includePublished || settings.demo || assessment.status==='blocked' || place.conflict) return null;
  const hours = publishedHours(place,settings.date,day);
  if (!hours?.windows?.length) return null;
  return {place,fit,split:false,provisional:true,sourceUrl:hours.url,
    windows:hours.windows.map(([open,close])=>[open,close,close-(hours.lastEntryMinutes ?? 0)])};
}

function buildDay(places, settings, day, splitId, stage, includePublished) {
  const city = stage?.city ?? cities[day];
  const date = isoDate(dateFor(settings.date,day));
  const candidates = places.map(place=>candidateFor(place,settings,day,splitId,includePublished)).filter(Boolean);
  const venues = (kind, location = city) => candidates.filter(item=>item.place.kind===kind && item.place.city===location);
  const visits = venues('visit').filter(item=>!stage?.visits || stage.visits.includes(item.place.id))
    .sort((a,b) => Number(b.split)-Number(a.split) || b.fit-a.fit);
  const mealCity = stage ? stage.mealCity ?? city : day===2 ? 'Суздаль' : city;
  const stayCity = stage?.stayCity ?? city;
  const secondVisit = (stage?.visitCount ?? (day===2 ? 1 : 2))===2;
  const roles = [{ candidates:visits, missing:'Подтверждённая точка посещения' }];
  const extra = {candidates:visits, missing:'Вторая точка посещения'};
  if (secondVisit && stage?.visitsFirst) roles.push(extra);
  roles.push({ candidates:venues('food',mealCity), missing:'Место для обеда', lunch:true });
  if (secondVisit && !stage?.visitsFirst) roles.push(extra);
  if (day<settings.days-1) roles.push({candidates:venues('stay',stayCity), missing:'Ночёвка'});

  const first = {cursor:600, stops:[], missing:[], hasSplit:false, fit:0,provisionalCount:0};
  if (stage) {
    first.cursor = stage.start;
    if (stage.inbound) first.stops.push(regionalTransfer(stage.inbound));
  } else {
    if (day===1) first.stops.push(travelStop('Владимир → Суздаль','弗拉基米尔 → 苏兹达尔',540,60));
    if (day===2) first.stops.push(travelStop('Суздаль → Кидекша','苏兹达尔 → 基杰克沙',540,25));
    if (day===1) first.cursor = 615;
    if (day===2) first.cursor = 580;
  }

  let paths = [first];
  for (const role of roles) {
    paths = paths.flatMap(path => {
      let {cursor, stops} = path;
      if (role.lunch && stage?.beforeLunch) {
        stops = [...stops,regionalTransfer(stage.beforeLunch,cursor)];
        cursor += stage.beforeLunch.minutes + 20;
      } else if (role.lunch && !stage && day===2) {
        stops = [...stops, travelStop('Кидекша → Суздаль','基杰克沙 → 苏兹达尔',cursor,25)];
        cursor += 45;
      }
      if (role.lunch) cursor = Math.max(cursor,720);
      const valid = role.candidates.flatMap(({place,audit,split,windows,fit,provisional,sourceUrl}) => {
        if (stops.some(stop=>stop.id === place.id)) return [];
        const duration = provisional ? estimatedDuration[place.kind] : visitDuration(audit,split);
        const window = windows.find(([opens,closes,entry])=>Math.max(cursor,opens)<=entry && Math.max(cursor,opens)+duration<=closes);
        if (!window) return [];
        const [opens] = window;
        const start = Math.max(cursor,opens);
        const end = start + duration;
        const stop = { type:place.kind,id:place.id,name:place.name,en:place.en,cn:place.cn,url:place.url,
          theme:place.theme,start:clockTime(start),end:clockTime(end),split,
          ...(provisional ? {provisional:true,sourceUrl} : {
            capacity:audit.capacity,booking:audit.booking,verifiedAt:audit.verifiedAt,sourceUrl:audit.sourceUrl,
          }),...(stage ? {formats:place.formats} : {}) };
        return [{cursor:end+20, stops:[...stops,stop], missing:path.missing,
          hasSplit:path.hasSplit || split, fit:path.fit+fit,provisionalCount:path.provisionalCount+Number(Boolean(provisional))}];
      });
      return [...valid,{...path, cursor, stops, missing:[...path.missing,role.missing]}];
    });
  }

  return paths.sort((a,b) => a.missing.length-b.missing.length || a.provisionalCount-b.provisionalCount ||
    Number(b.hasSplit)-Number(a.hasSplit) || b.fit-a.fit)
    .map(({stops,missing}) => ({city,date,stops,missing,
      ...(stage ? {mealCity,stayCity,cn:stage.cn,en:stage.en,visitIds:stage.visits} : {})}));
}

function routeCandidates(places, settings, splitId, includePublished = false) {
  const stages = scheduleFor(settings);
  const days = Array.from({length:settings.days},(_,day)=>buildDay(places,settings,day,splitId,stages?.[day],includePublished));
  const issuesFor = (place,day) => {
    const result = assess(place,settings,day);
    return result.status==='ready' ? [] : [{id:place.id,name:place.name,city:place.city,day,...result}];
  };
  if (stages) {
    const issues = stages.flatMap((stage,day)=>places.filter(place=>{
      if (place.kind==='food') return place.city===(stage.mealCity ?? stage.city);
      if (place.kind==='stay') return day<settings.days-1 && place.city===(stage.stayCity ?? stage.city);
      return place.city===stage.city && (!stage.visits || stage.visits.includes(place.id));
    }).flatMap(place=>issuesFor(place,day)));
    return {days,issues};
  }
  const issues = places.flatMap(place => {
    const index = cities.indexOf(place.city);
    const daysToCheck = index===1 && place.kind==='food' && settings.days===3 ? [1,2] : [index];
    return daysToCheck.filter(day=>day>=0 && day<settings.days).flatMap(day=>issuesFor(place,day));
  });
  return {days,issues};
}

function assembleRoute(settings, days, issues) {
  const outdoor = ['hike','nature'].includes(settings.theme);
  const requiresTheme = outdoor || ['craft','pilgrimage'].includes(settings.theme);
  const missingTheme = requiresTheme && !days.some(day=>day.stops.some(stop=>
    stop.theme===settings.theme || stop.formats?.includes(settings.theme)));
  const direction = settings.direction && routeDirections.find(item=>item.id===settings.direction);
  const themeNote = missingTheme
    ? direction ? 'Для выбранного формата требуется ключевая остановка с подходящими условиями на дату поездки.' :
      'В пилотном каталоге нет подтверждённых объектов для этого формата. Культурные остановки показаны для справки.'
    : settings.theme==='family' ? 'Приоритет у музеев. Возрастные условия и семейные услуги нужно уточнить у объектов.'
    : settings.theme==='romantic' ? 'Приоритет у архитектурных остановок и коротких визитов.' : null;
  const assumptions = [direction ? 'Время переездов ориентировочное. Сверьте время в пути и точки посадки с перевозчиком, а групповые места с поставщиками.' :
    'Переезды и запас между остановками рассчитаны по схеме пилота. Транспорт и брони подтверждаются отдельно.'];
  if (direction?.id==='bogolyubovo') assumptions.push('Перед пешей частью проверьте состояние тропы, световой день и доступность после паводка или снегопада.');
  if (days.some(day=>day.stops.some(stop=>stop.split))) assumptions.push('Два сеанса и ожидание второй подгруппы нужно согласовать с объектом.');
  return { settings, days, issues, themeNote, assumptions,
    ...(direction ? {direction} : {}),
    completeness:!missingTheme && days.every(day => day.missing.length === 0) };
}

export function planRoute(places, settings, splitId = null) {
  const {days, issues} = routeCandidates(places,settings,splitId);
  return assembleRoute(settings,days.map(choices=>choices[0]),issues);
}

export function previewPublishedRoute(places,settings) {
  if (settings.demo) return null;
  const {days,issues} = routeCandidates(places,settings,null,true);
  const itinerary = days.map(choices=>choices[0]);
  if (!itinerary.some(day=>day.stops.some(stop=>stop.provisional))) return null;
  return {...assembleRoute(settings,itinerary,issues),completeness:false,publishedPreview:true};
}

function itineraryKey(plan) {
  const days = plan.days.map(day=>[day.date,day.stops.map(stop=>[
    stop.id ?? stop.name,stop.start,stop.end,Boolean(stop.split),stop.capacity,stop.booking,stop.verifiedAt,
  ])]);
  return JSON.stringify([plan.settings,days]);
}

function itineraryId(plan) {
  let hash = 2166136261;
  for (const symbol of itineraryKey(plan)) hash = Math.imul(hash^symbol.codePointAt(0),16777619);
  return 'programme-' + (hash>>>0).toString(36);
}

export function routeAlternatives(places, settings) {
  const {days,issues} = routeCandidates(places,settings);
  const preferred = days.map(choices=>choices[0]);
  const available = new Map();
  function add(title, plan) {
    if (!plan.completeness) return;
    const id = itineraryId(plan);
    if (!available.has(id)) available.set(id,{id,title,plan});
  }
  add('Основная программа',assembleRoute(settings,preferred,issues));

  if (settings.demo && settings.size > (places.find(place=>place.id==='suzdal-kremlin')?.audit?.capacity ?? Infinity)) {
    const split = planRoute(places,settings,'suzdal-kremlin');
    if (split.days.some(day=>day.stops.some(stop=>stop.split))) add('Два сеанса в Суздальском кремле',split);
  }

  const priority = settings.days===3 ? [1,0,2] : [1,0];
  for (let option=1; option<6 && available.size<6; option++) {
    for (const day of priority) {
      const variant = days[day][option];
      if (!variant || variant.missing.length || available.size>=6) continue;
      add('Другой вариант '+(day+1)+'-го дня',assembleRoute(settings,preferred.with(day,variant),issues));
    }
  }
  return [...available.values()];
}

export function reviewRoute(places, plan) {
  const byId = new Map(places.map(place=>[place.id,place]));
  const issues = plan.days.flatMap((day,index)=>day.stops.flatMap(stop=>{
    if (!stop.id) return [];
    const place = byId.get(stop.id);
    const issue = {id:stop.id,name:stop.name,city:place?.city ?? day.city,day:index};
    if (!place) return [{...issue,status:'unknown',reasons:['В каталоге больше нет этой остановки.']}];
    const settings = stop.split ? {...plan.settings,size:Math.ceil(plan.settings.size/2)} : plan.settings;
    const assessment = assess(place,settings,index);
    if (assessment.status!=='ready') return [{...issue,...assessment}];
    const audit = conditionsFor(place,settings);
    if (stop.booking && stop.booking!==audit.booking) {
      return [{...issue,status:'unknown',reasons:['Условия записи изменились. Проверьте согласование визита.']}];
    }
    const start = clockMinutes(stop.start);
    const end = clockMinutes(stop.end);
    const withinHours = openingWindows(place,audit,settings,index).some(([opens,closes,entry])=>start>=opens && end<=closes && start<=entry);
    if (!withinHours || end - start < visitDuration(audit,stop.split)) {
      return [{...issue,status:'blocked',reasons:['Текущие часы или длительность визита не подходят для запланированного времени.']}];
    }
    return [];
  }));
  return {feasible:plan.completeness && issues.length===0,issues};
}

function monitoredProgrammes(catalog, state, beforeAudit, beforeWiki) {
  const previous = objectsFrom(catalog,{...state,audit:beforeAudit,wiki:beforeWiki});
  const routes = new Map([...trackedRoutes,...(state.savedRoutes ?? [])].map(route=>[route.id,route]));
  return [...routes.values()].map(route=>({
    ...route, baseline:route.baseline ?? planRoute(previous,route.settings),
  }));
}

export function impacts(catalog, state, beforeAudit, beforeWiki) {
  const current = objectsFrom(catalog,state);
  return monitoredProgrammes(catalog,state,beforeAudit,beforeWiki).map(route => {
    const {baseline} = route;
    const check = reviewRoute(current,baseline);
    const updated = check.feasible ? baseline : planRoute(current,route.settings);
    const initial = baseline.days.flatMap(day => day.stops.filter(stop => stop.id));
    const revised = updated.days.flatMap(day => day.stops.filter(stop => stop.id));
    const removed = initial.filter(stop => !revised.some(x => x.id === stop.id));
    const added = revised.filter(stop => !initial.some(x => x.id === stop.id));
    const shifted = revised.filter(stop => initial.some(x=>x.id===stop.id && (x.start!==stop.start || x.end!==stop.end)));
    return { id:route.id,title:route.title,subtitle:route.subtitle,settings:route.settings,
      baseline,currentPlan:updated,removed,added,shifted,
      affected:check.issues.length > 0 || removed.length > 0 || added.length > 0 || shifted.length > 0,
      issues:check.issues };
  });
}

export function attributeChanges(changes, places, programs) {
  const byId = new Map(places.map(place=>[place.id,place]));
  const seen = new Set();
  const auditFields = new Set(['capacity','language','hours','off','seasons','minutes','access','booking','validUntil']);
  const batches = new Map();
  const batchesByChange = new Map();
  const newConflicts = new Map();
  for (const [index,change] of changes.entries()) {
    const place = byId.get(change.id);
    if (change.key==='wikiName' && !change.demo) {
      const key = 'wiki|'+change.id;
      if (!place || seen.has(key)) continue;
      seen.add(key);
      if (place.wikiName===change.after && place.conflict && !conflictingNames(place.name,change.before)) {
        newConflicts.set(index,place.id);
      }
      continue;
    }
    const auditKey = change.demo ? 'audit' : 'verifiedAudit';
    const audit = place?.[auditKey];
    const key = [auditKey,change.id,change.key].join('|');
    if (!audit || !auditFields.has(change.key) || seen.has(key)) continue;
    seen.add(key);
    const nullable = ['language','access'].includes(change.key);
    if (change.before===undefined || (change.before===null && !nullable) ||
        JSON.stringify(audit[change.key])!==JSON.stringify(change.after)) continue;
    const batchKey = [auditKey,change.id,change.at].join('|');
    const batch = batches.get(batchKey) ?? {place,auditKey,audit,before:{}};
    batch.before[change.key] = change.before;
    batches.set(batchKey,batch);
    batchesByChange.set(index,batch);
  }
  const worsened = (current,former)=>current.some(issue=>!former.some(previous=>previous.day===issue.day &&
    (previous.status===issue.status || previous.status==='blocked')));
  return changes.map((change,index)=>{
    const identity = newConflicts.get(index);
    if (identity) {
      const affectedProgramIds = programs.filter(program=>program.issues.some(issue=>
        issue.id===identity && issue.status==='unknown')).map(program=>program.id);
      return {...change,affectedProgramIds};
    }
    const batch = batchesByChange.get(index);
    if (!batch) return change;
    const {place,auditKey,audit,before} = batch;
    const previousAudit = {...audit,...before};
    const previous = {...place,[auditKey]:previousAudit};
    const withoutChange = {...place,[auditKey]:{...audit,[change.key]:change.before}};
    const onlyChange = {...place,[auditKey]:{...previousAudit,[change.key]:change.after}};
    const simultaneous = Object.keys(before).length>1;
    const affectedProgramIds = programs.filter(program=>{
      if (Boolean(program.settings.demo)!==Boolean(change.demo)) return false;
      const current = program.issues.filter(issue=>issue.id===place.id);
      if (!current.length) return false;
      const atPlace = candidate=>reviewRoute([candidate],program.baseline).issues.filter(issue=>issue.id===place.id);
      if (worsened(current,atPlace(withoutChange))) return true;
      // A simultaneous closure can mask a reduced limit, or vice versa.
      return simultaneous && worsened(atPlace(onlyChange),atPlace(previous));
    }).map(program=>program.id);
    return {...change,affectedProgramIds};
  });
}

function capacityReductions(programmes, places, beforeAudit) {
  const byId = new Map(places.map(place=>[place.id,place]));
  const reductions = new Map();
  for (const route of programmes.filter(programme=>!programme.feasible)) {
    const {settings} = route;
    for (const stop of route.baseline.days.flatMap(day=>day.stops)) {
      const place = byId.get(stop.id);
      if (!place) continue;
      const audit = conditionsFor(place,settings);
      const previous = settings.demo ? beforeAudit?.objects?.[place.id]?.capacity : stop.capacity;
      const size = stop.split ? Math.ceil(settings.size/2) : settings.size;
      if (!audit || !(previous > audit.capacity && size > audit.capacity)) continue;
      const key = String(settings.demo)+':'+place.id;
      const capacity = Math.max(previous,reductions.get(key)?.capacity ?? 0);
      reductions.set(key,{place,audit,capacity,demo:settings.demo});
    }
  }
  return [...reductions.values()];
}

export function portfolioImpact(catalog, state, beforeAudit, beforeWiki, demo) {
  const current = objectsFrom(catalog,state);
  const programmes = monitoredProgrammes(catalog,state,beforeAudit,beforeWiki)
    .filter(route=>demo===undefined || route.settings.demo===demo)
    .map(route=>({...route,feasible:reviewRoute(current,route.baseline).feasible}));
  const currentCount = programmes.filter(route=>route.feasible).length;
  const baselineCount = programmes.filter(route=>route.baseline.completeness).length;
  const scenario = (id,title,description,recover) => {
    const results = programmes.map(route=>({id:route.id,title:route.title,subtitle:route.subtitle,
      before:route.feasible,after:route.feasible || recover(route)}));
    const feasibleCount = results.filter(route=>route.after).length;
    return {id,title,description,feasibleCount,delta:feasibleCount-currentCount,programs:results};
  };
  const scenarios = [scenario('replacement','Подобрать замену',
    'Заменить недоступные остановки в пределах тех же дат, размера группы и требований. Вместимость объектов остаётся прежней.',
    route=>planRoute(current,route.settings).completeness)];

  const reductions = capacityReductions(programmes,current,beforeAudit);
  for (const [index,{place,audit,capacity,demo:demoCapacity}] of reductions.entries()) {
    const suffix = index ? '-'+(demoCapacity ? 'demo-' : '')+place.id : '';
    if (demoCapacity && place.kind==='visit') {
      scenarios.push(scenario('split'+suffix,'Согласовать второй сеанс',
        'Учебный расчёт для объекта «'+place.name+'». Если доступны два последовательных сеанса, каждая подгруппа должна уложиться в лимит '+audit.capacity+' чел.',
        route=>{
          if (!route.settings.demo) return false;
          const plan = planRoute(current,route.settings,place.id);
          return plan.completeness && plan.days.some(day=>day.stops.some(stop=>stop.id===place.id && stop.split));
        }));
    }
    const field = demoCapacity ? 'audit' : 'verifiedAudit';
    const restored = current.map(item=>item.id===place.id ? {...item,[field]:{...audit,capacity}} : item);
    scenarios.push(scenario('capacity'+suffix,'Восстановить вместимость',
      (demoCapacity ? 'Учебный расчёт для объекта «' : 'Гипотеза для объекта «')+place.name+'». Если лимит вернётся с '+audit.capacity+
        ' до ранее зафиксированных '+capacity+' чел., прочие условия остаются прежними.',
      route=>route.settings.demo===demoCapacity && reviewRoute(restored,route.baseline).feasible));
  }
  return {total:programmes.length,baselineCount,currentCount,scenarios};
}

function evidenceLinks(items) {
  return [...new Map(items.filter(item=>item.url).map(item=>[item.url,item])).values()];
}

function pilotDate(places, lowMonths, earliestDate) {
  if (!lowMonths.length) return null;
  // Compare only weekends with dated venue schedules in both cities.
  for (let offset = 0; offset < 366; offset++) {
    const start = dateFor(earliestDate,offset);
    if (start.getUTCDay()!==6 || !lowMonths.includes(months[start.getUTCMonth()])) continue;
    const date = isoDate(start);
    const covered = cities.slice(0,2).every((city,day)=>places.some(place=>{
      if (place.city!==city || place.kind!=='visit') return false;
      const hours = publishedHours(place,date,day);
      return hours?.validUntil && hours.windows?.length;
    }));
    if (covered) return date;
  }
  return null;
}

const dateRange = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'});

function study(places, settings) {
  const candidates = cities.slice(0,2).flatMap((city,day)=>places.filter(place=>place.city===city &&
    (place.kind!=='stay' || day===0)).map(place=>({place,day,result:assess(place,settings,day),hours:publishedHours(place,settings.date,day)})));
  const plan = planRoute(places,settings);
  const dates = dateRange.formatRange(dateFor(plan.days[0].date,0),dateFor(plan.days.at(-1).date,0));
  return {candidates,plan,dates};
}

function priorityForChange(route, byId, state) {
  const changedStops = route.issues.length ? route.issues : route.shifted;
  const reason = changedStops.map(stop=>stop.name+(stop.reasons?.length ? '. '+stop.reasons.join(' ') : '')).join(' ');
  let action = 'Сверить новые условия на дату визита перед повторным согласованием.';
  if (route.added.length) action = 'Сравнить рассчитанный вариант с посещением '+route.added.map(stop=>'«'+stop.name+'»').join(', ')+'.';
  else if (route.shifted.length && route.currentPlan.completeness) action = 'Сверить новое расписание для тех же остановок.';
  else if (!route.currentPlan.completeness) action = 'Подобрать запасные объекты для незаполненных частей программы.';
  const identitySources = changedStops.flatMap(stop=>{
    const place = byId.get(stop.id);
    return place?.conflict && place.wikiLink ? [{title:stop.name+' · Wikidata',url:place.wikiLink,checkedAt:place.wikiCheckedAt}] : [];
  });
  const visitSources = route.settings.demo ? [{title:'Учебный аудит',url:'/api/audit-version/'+state.audit.version}] :
    changedStops.flatMap(stop=>{
      const place = byId.get(stop.id);
      return place?.conflict && place.wikiLink ? [] :
        [{title:stop.name,url:place?.verifiedAudit?.sourceUrl ?? place?.publishedConditions?.schedule?.url ?? place?.url}];
    });
  return {title:'Перепроверить посещение · '+route.subtitle,
    text:[route.settings.demo ? 'Учебный сценарий.' : '',reason,action].filter(Boolean).join(' '),urgent:true,
    sources:evidenceLinks([...identitySources,...visitSources])};
}

export function recommendations(places,state,affected) {
  const byId = new Map(places.map(place=>[place.id,place]));
  const result = affected.filter(route=>route.affected).map(route=>priorityForChange(route,byId,state));
  const stats = statSummary(state.stats.nights,[]);
  const lowMonths = stats.lows.map(item=>item.month);
  const years = stats.years.map(item=>item.year).join(', ');
  const statsSource = {title:'Ночёвки · Росстат',url:stats.source ?? stats.publication};
  const earliestDate = [defaultRoute.date,state.refreshedAt?.slice(0,10)].filter(Boolean).sort().at(-1);
  const date = pilotDate(places,lowMonths,earliestDate);
  const settings = {...defaultRoute,date:date ?? earliestDate,demo:false};
  const {candidates,plan,dates} = study(places,settings);
  const visits = candidates.filter(item=>item.place.kind==='visit');
  const scheduled = visits.filter(item=>item.hours?.windows?.length);
  const scheduleSources = evidenceLinks(scheduled.map(item=>({title:'Опубликованный график',url:item.hours.url})));
  const low = stats.lows.map(item=>item.month+' · '+number(item.value)+' ночёвок').join(', ');
  const seasonality = low ? 'Месяцы с низкими средними значениями для средств размещения Владимирской области за '+years+' гг. — '+low+'.' :
    'Для сравнения нужны сопоставимые месячные ряды ночёвок.';
  const nextStep = date ? 'Проверить двухдневный пилот Владимир → Суздаль на '+dates+' для группы из '+settings.size+
    ' человек. Для '+scheduled.length+' из '+visits.length+' позиций каталога для посещения опубликованы часы на эти даты.' :
    'Сверить графики в обоих городах перед выбором дат двухдневного пилота.';
  result.push({title:'Проверить спрос на второй день в низкий сезон',text:seasonality+' '+nextStep+
    ' Для оценки причин спада и спроса на конкретную программу нужны отдельные данные.',sources:evidenceLinks([statsSource,...scheduleSources])});

  const missingLanguage = scheduled.filter(({place,day})=>assess(place,{...settings,market:'ru'},day).status==='ready' &&
    assess(place,settings,day).status==='unknown');
  const uncheckedVisits = scheduled.filter(item=>item.result.status!=='ready');
  const languageTargets = missingLanguage.length ? missingLanguage : uncheckedVisits;
  if (languageTargets.length || !scheduled.length) {
    const text = missingLanguage.length ? 'Для '+missingLanguage.length+' объектов условия визита подтверждены для русскоязычной группы, а работу с переводчиком нужно уточнить.' :
      (uncheckedVisits.length ? 'У '+uncheckedVisits.length+' объектов есть часы посещения на '+dates+', требуется подтверждение группового визита.' :
      'На даты пилота нет опубликованного расписания объектов, по которым можно оценить условия сопровождения.');
    const links = evidenceLinks(languageTargets.map(({place})=>({title:place.name,url:place.publishedConditions?.booking?.url ?? place.url}))).slice(0,3);
    result.push({title:'Согласовать сопровождение китайской группы',text:text+
      ' Запросить у поставщиков места на сеанс, лимит группы и работу с китайскоязычным сопровождающим.',sources:links});
  }

  const capacity = candidates.filter(item=>item.place.kind==='stay' || item.place.kind==='food');
  const missingRoles = plan.days.flatMap((day,index)=>day.missing.filter(role=>['Место для обеда','Ночёвка'].includes(role))
    .map(role=>role.toLowerCase()+' в день '+(index+1)+' ('+day.city+')'));
  if (missingRoles.length) {
    result.push({title:'Запросить наличие мест на даты поездки',text:'На '+dates+' в расчёте для группы из '+settings.size+
      ' человек требуют подтверждения '+missingRoles.join(', ')+'. Запросить номера на одну ночь, рассадку и обеденное окно. '+
      'Транспорт и фактические брони проверяет специалист.',sources:evidenceLinks(capacity.filter(item=>item.result.status!=='ready').map(({place})=>
      ({title:place.name,url:place.publishedConditions?.booking?.url ?? place.url})))});
  }
  return result;
}
