export const region = 'Владимирская область';
export const officialStatistics = 'https://rosstat.gov.ru/statistics/turizm';
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
  const full = selected.filter(y => y.total !== null);
  const comparison = full.length ? full : selected;
  const averages = months.map((month, i) => {
    const values = comparison.map(y => y.monthly[i]).filter(Number.isFinite);
    return { month, value: values.length === comparison.length && values.length ? Math.round(values.reduce((a,b) => a+b,0) / values.length) : null };
  });
  const lows = averages.filter(x => x.value !== null).sort((a,b) => a.value - b.value).slice(0,3);
  const latest = full.at(-1);
  const previous = full.at(-2);
  const summer = latest?.monthly.slice(5,8).reduce((a,b) => a+b,0);
  return { ...series, years: selected, averages, lows, latest, summerShare: summer ? Math.round(summer * 100 / latest.total) : null,
    yoy: latest && previous?.year === latest.year-1 && previous.total ? (latest.total / previous.total - 1) * 100 : null };
}

export const defaultRoute = { days:2, date:'2026-11-21', size:18, market:'zh', theme:'heritage', access:false, demo:true };
export const trackedRoutes = [
  { id:'group-cn', title:'Владимир → Суздаль', subtitle:'Группа из Китая', settings:defaultRoute },
  { id:'group-small', title:'Владимир → Суздаль', subtitle:'Малая группа', settings:{...defaultRoute, size:8, market:'ru'} },
];
const cities = ['Владимир','Суздаль','Кидекша'];
const themes = ['heritage','museum','any','romantic','family','hike','nature'];
const exteriorVisits = new Set(['golden-gate']);
const shortHeritageVisits = new Set(['dmitrovsky','golden-gate','nativity','kideksha']);
export const kindNames = { visit:'Посещение', food:'Питание', stay:'Размещение' };
export const fieldNames = {
  capacity:'Лимит группы', language:'Сопровождение', hours:'Часы работы', off:'Выходные дни',
  seasons:'Сезонность', minutes:'Продолжительность визита', access:'Безбарьерный доступ',
  coordinates:'Координаты', wikiName:'Название в Wikidata', total:'Годовое значение',
};
const time = minutes => Math.trunc(minutes / 60).toString().padStart(2,'0') + ':' + (minutes % 60).toString().padStart(2,'0');
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
  return {
    days:Number(input.days) === 3 ? 3 : 2, date,
    size:Number.isInteger(size) && size >= 1 && size <= 100 ? size : defaultRoute.size,
    market:input.market === 'ru' ? 'ru' : 'zh',
    theme:themes.includes(input.theme) ? input.theme : 'heritage',
    access:input.access === true, demo:input.demo !== false,
  };
}

export function objectsFrom(catalog, state) {
  return catalog.map(place => {
    const wiki = state.wiki?.[place.qid];
    const canonical = value => value.toLowerCase().replaceAll('ё','е').split(' — ')[0].trim();
    return { ...place, coordinates:wiki?.coordinates ?? null, wikiName:wiki?.wikiName ?? null,
      checkedAt:'2026-11-17', wikiCheckedAt:wiki?.checkedAt ?? null,
      conflict:Boolean(wiki?.wikiName && canonical(place.name)!==canonical(wiki.wikiName)),
      wikiLink:place.qid ? 'https://www.wikidata.org/wiki/' + place.qid : null,
      audit:state.audit?.objects?.[place.id] ?? null,
      verifiedAudit:state.verifiedAudit?.objects?.[place.id] ?? null };
  });
}

export function conditionsFor(place, settings) {
  return settings.demo ? place.audit : place.verifiedAudit;
}

export function assess(place, settings, day = 0) {
  if (place.conflict) return { status:'unknown',reasons:['Название в Wikidata отличается от названия в каталоге. Сверьте идентичность объекта.'] };
  const audit = conditionsFor(place, settings);
  if (!audit) return { status:'unknown', reasons:['Нужны подтверждённые часы, условия записи и лимит группы.'] };
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
  if (reasons.length) return { status:'blocked', reasons };
  if (settings.market === 'zh' && audit.language !== 'interpreter') reasons.push('Работа с китайскоязычным переводчиком требует подтверждения.');
  if (settings.access && audit.access !== true) reasons.push('Безбарьерный доступ требует подтверждения.');
  return { status:reasons.length ? 'unknown' : 'ready', reasons };
}

function themeFit(place, theme) {
  if (place.kind !== 'visit') return 0;
  if (theme === 'romantic') return Number(shortHeritageVisits.has(place.id) || place.id === 'suzdal-kremlin');
  if (theme === 'family') return Number(place.theme === 'museum');
  if (theme === 'hike' || theme === 'nature') return place.theme===theme ? 2 : Number(exteriorVisits.has(place.id));
  return Number(place.theme === theme);
}

function travelStop(name, cn, start, duration) {
  return { type:'travel', name, cn, start:time(start), end:time(start+duration) };
}

function openingWindow(audit) {
  return [Math.round(audit.hours[0] * 60), Math.min(18 * 60, Math.round(audit.hours[1] * 60))];
}

const visitDuration = (audit, split) => split ? audit.minutes * 2 + 15 : audit.minutes;

function candidateFor(place, settings, day, splitId) {
  const audit = conditionsFor(place, settings);
  const split = Boolean(settings.demo && place.kind === 'visit' && place.id === splitId &&
    audit?.capacity < settings.size && audit.capacity * 2 >= settings.size);
  const group = split ? {...settings, size:Math.ceil(settings.size/2)} : settings;
  if (assess(place,group,day).status !== 'ready') return null;
  return { place, audit, split, fit:themeFit(place,settings.theme) };
}

function buildDay(places, settings, day, splitId) {
  const city = cities[day];
  const date = isoDate(dateFor(settings.date,day));
  const candidates = places.map(place=>candidateFor(place,settings,day,splitId)).filter(Boolean);
  const venues = (kind, location = city) => candidates.filter(item=>item.place.kind===kind && item.place.city===location);
  const visits = venues('visit').sort((a,b) => Number(b.split)-Number(a.split) || b.fit-a.fit);
  const roles = [
    { candidates:visits, missing:'Подтверждённая точка посещения' },
    { candidates:venues('food',day===2 ? 'Суздаль' : city), missing:'Место для обеда', lunch:true },
  ];
  if (day!==2) roles.push({candidates:visits, missing:'Вторая точка посещения'});
  if (day<settings.days-1) roles.push({candidates:venues('stay'), missing:'Ночёвка'});

  const first = {cursor:600, stops:[], missing:[], hasSplit:false, fit:0};
  if (day===1) first.stops.push(travelStop('Владимир → Суздаль','弗拉基米尔 → 苏兹达尔',540,60));
  if (day===2) first.stops.push(travelStop('Суздаль → Кидекша','苏兹达尔 → 基杰克沙',540,25));
  if (day===1) first.cursor = 615;
  if (day===2) first.cursor = 580;

  let paths = [first];
  for (const role of roles) {
    paths = paths.flatMap(path => {
      let {cursor, stops} = path;
      if (role.lunch && day===2) {
        stops = [...stops, travelStop('Кидекша → Суздаль','基杰克沙 → 苏兹达尔',cursor,25)];
        cursor += 45;
      }
      if (role.lunch) cursor = Math.max(cursor,720);
      const valid = role.candidates.flatMap(({place, audit, split, fit}) => {
        if (stops.some(stop=>stop.id === place.id)) return [];
        const [opens, closes] = openingWindow(audit);
        const start = Math.max(cursor,opens);
        const end = start + visitDuration(audit,split);
        if (end > closes) return [];
        const stop = { type:place.kind, id:place.id, name:place.name, cn:place.cn, url:place.url,
          theme:place.theme, start:time(start), end:time(end), capacity:audit.capacity, split,
          booking:audit.booking, verifiedAt:audit.verifiedAt, sourceUrl:audit.sourceUrl };
        return [{cursor:end+20, stops:[...stops,stop], missing:path.missing,
          hasSplit:path.hasSplit || split, fit:path.fit+fit}];
      });
      return [...valid,{...path, cursor, stops, missing:[...path.missing,role.missing]}];
    });
  }

  return paths.sort((a,b) => a.missing.length-b.missing.length || Number(b.hasSplit)-Number(a.hasSplit) || b.fit-a.fit)
    .map(({stops,missing}) => ({city,date,stops,missing}));
}

function routeCandidates(places, settings, splitId) {
  const days = Array.from({length:settings.days},(_,day)=>buildDay(places,settings,day,splitId));
  const issues = places.flatMap(place => {
    const index = cities.indexOf(place.city);
    const daysToCheck = index===1 && place.kind==='food' && settings.days===3 ? [1,2] : [index];
    return daysToCheck.filter(day=>day>=0 && day<settings.days).flatMap(day=>{
      const result = assess(place,settings,day);
      return result.status==='ready' ? [] : [{id:place.id,name:place.name,city:place.city,day,...result}];
    });
  });
  return {days,issues};
}

function assembleRoute(settings, days, issues) {
  const outdoor = ['hike','nature'].includes(settings.theme);
  const missingTheme = outdoor && !days.some(day=>day.stops.some(stop=>stop.theme===settings.theme));
  const themeNote = missingTheme
    ? 'В пилотном каталоге нет подтверждённых природных объектов или пеших троп. Культурные остановки показаны для справки.'
    : settings.theme==='family' ? 'Приоритет у музеев. Возрастные условия и семейные услуги нужно уточнить у объектов.'
    : settings.theme==='romantic' ? 'Приоритет у архитектурных остановок и коротких визитов.' : null;
  const assumptions = ['Переезды и запас между остановками рассчитаны по схеме пилота. Транспорт и брони подтверждаются отдельно.'];
  if (days.some(day=>day.stops.some(stop=>stop.split))) assumptions.push('Два сеанса и ожидание второй подгруппы нужно согласовать с объектом.');
  return { settings, days, issues, themeNote, assumptions,
    completeness:!missingTheme && days.every(day => day.missing.length === 0) };
}

export function planRoute(places, settings, splitId = null) {
  const {days, issues} = routeCandidates(places,settings,splitId);
  return assembleRoute(settings,days.map(choices=>choices[0]),issues);
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
    const issue = {id:stop.id,name:stop.name,city:day.city,day:index};
    const place = byId.get(stop.id);
    if (!place) return [{...issue,status:'unknown',reasons:['В каталоге больше нет этой остановки.']}];
    const settings = stop.split ? {...plan.settings,size:Math.ceil(plan.settings.size/2)} : plan.settings;
    const assessment = assess(place,settings,index);
    if (assessment.status!=='ready') return [{...issue,...assessment}];
    const audit = conditionsFor(place,settings);
    if (stop.booking && stop.booking!==audit.booking) {
      return [{...issue,status:'unknown',reasons:['Условия записи изменились. Проверьте согласование визита.']}];
    }
    const [opens,closes] = openingWindow(audit);
    const start = clockMinutes(stop.start);
    const end = clockMinutes(stop.end);
    if (start < opens || end > closes || end - start < visitDuration(audit,stop.split)) {
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

export function recommendations(places,state,affected) {
  const missing = places.filter(p => p.kind === 'visit' && p.audit?.language !== 'interpreter');
  const result = [];
  for (const route of affected.filter(x => x.affected && x.removed.length)) {
    result.push({ title:'Перепроверить посещение · '+route.subtitle, text:route.issues.map(x => x.name+'. '+x.reasons.join(' ')).join(' ') +
      (route.added.length ? ' Предложенная замена — '+route.added.map(x=>x.name).join(', ')+'.' : ' Нужен запасной объект.'), urgent:true });
  }
  const stats = statSummary(state.stats.nights,[]);
  const low = stats.lows.map(x=>x.month).join(', ');
  result.push({title:'Проверить спрос на второй день в низкий сезон',text:low
    ? 'Месяцы с минимумом ночёвок в сопоставимом ряду — '+low+'. Проверить гипотезу о спросе на второй день с крытой программой и ночёвкой.'
    : 'Собрать сопоставимый ряд ночёвок, затем выбрать даты для пилота.'});
  result.push({title:'Согласовать сопровождение китайской группы',text:missing.length+' объектов посещения в учебном каталоге требуют уточнения условий работы с переводчиком. Запросить подтверждение на даты маршрута и по размеру группы.'});
  result.push({title:'Запросить наличие мест на даты поездки',text:'Подтвердить комнаты, рассадку в ресторанах и транспорт у поставщиков. В каталоге фиксируются источники, а бронь проверяет эксперт.'});
  return result;
}
