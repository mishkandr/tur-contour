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
export const kindNames = { visit:'Посещение', food:'Питание', stay:'Размещение' };
export const fieldNames = {
  capacity:'Лимит группы', language:'Сопровождение', hours:'Часы работы', off:'Выходные дни',
  seasons:'Сезонность', minutes:'Продолжительность визита', access:'Безбарьерный доступ',
  coordinates:'Координаты', wikiName:'Название в Wikidata', total:'Годовое значение',
};
const time = minutes => Math.trunc(minutes / 60).toString().padStart(2,'0') + ':' + (minutes % 60).toString().padStart(2,'0');
const dateFor = (date, offset) => new Date(Date.parse(date+'T12:00:00Z') + offset*86400000);
const seasonFor = month => month === 0 || month === 1 || month === 11 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'autumn';

export function routeSettings(input) {
  const date = /^20\d{2}-\d{2}-\d{2}$/.test(input.date) && Number.isFinite(Date.parse(input.date)) &&
    new Date(input.date).toISOString().slice(0,10) === input.date ? input.date : defaultRoute.date;
  const size = Number(input.size);
  return {
    days:Number(input.days) === 3 ? 3 : 2, date,
    size:Number.isInteger(size) && size >= 1 && size <= 100 ? size : defaultRoute.size,
    market:input.market === 'ru' ? 'ru' : 'zh',
    theme:['heritage','museum','any'].includes(input.theme) ? input.theme : 'heritage',
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
      audit:state.audit.objects[place.id] ?? null };
  });
}

export function assess(place, settings, day = 0) {
  if (place.conflict) return { status:'unknown',reasons:['Название в Wikidata отличается от названия в каталоге. Сверьте идентичность объекта.'] };
  const audit = settings.demo ? place.audit : null;
  if (!audit) return { status:'unknown', reasons:['Нужны подтверждённые часы, условия записи и лимит группы.'] };
  const date = dateFor(settings.date, day);
  const reasons = [];
  if (audit.capacity < settings.size) reasons.push('Лимит ' + audit.capacity + ' чел. для группы из ' + settings.size + '.');
  if (audit.off.includes(date.getUTCDay())) reasons.push('Выходной по учебному графику.');
  if (!audit.seasons.includes('all') && !audit.seasons.includes(seasonFor(date.getUTCMonth()))) reasons.push('Объект вне сезона по учебному графику.');
  if (settings.access && audit.access === false) reasons.push('Безбарьерный доступ недоступен по учебному аудиту.');
  if (reasons.length) return { status:'blocked', reasons };
  if (settings.market === 'zh' && audit.language !== 'interpreter') reasons.push('Работа с китайскоязычным переводчиком требует подтверждения.');
  if (settings.access && audit.access !== true) reasons.push('Безбарьерный доступ требует подтверждения.');
  return { status:reasons.length ? 'unknown' : 'ready', reasons };
}

function rankPlaces(places, theme) {
  return places.toSorted((a,b) => Number(b.theme === theme) - Number(a.theme === theme));
}

export function planRoute(places, settings, splitId = null) {
  const days = [];
  const issues = [];
  for (let day = 0; day < settings.days; day += 1) {
    const city = cities[day];
    const previousCity = cities[day-1];
    const date = dateFor(settings.date, day).toISOString().slice(0,10);
    const cityPlaces = places.filter(place => place.city === city);
    const visits = rankPlaces(cityPlaces.filter(x => x.kind === 'visit'), settings.theme);
    const stops = [];
    let cursor = day === 0 ? 600 : 540;
    if (day) {
      const travel = day === 1 ? 60 : 25;
      stops.push({ type:'travel', name:previousCity+' → '+city, cn:day === 1 ? '弗拉基米尔 → 苏兹达尔' : '苏兹达尔 → 基杰克沙',
        start:time(cursor), end:time(cursor+travel) });
      cursor += travel + 15;
    }

    const add = place => {
      const audit = place.audit;
      const split = settings.demo && place.id===splitId && audit?.capacity < settings.size &&
        audit.capacity*2 >= settings.size;
      const conditions = assess(place, split ? {...settings,size:Math.ceil(settings.size/2)} : settings, day);
      if (conditions.status !== 'ready') return false;
      const start = Math.max(cursor, audit.hours[0] * 60);
      const end = start + (split ? audit.minutes*2+15 : audit.minutes);
      if (end > Math.min(18, audit.hours[1]) * 60) return false;
      stops.push({ type:place.kind, id:place.id, name:place.name, cn:place.cn, url:place.url, start:time(start), end:time(end), capacity:audit.capacity, split });
      cursor = end + 20;
      return true;
    };

    const morning = visits.find(add);
    const lunchSearch = (day === 2 ? places.filter(x => x.city === 'Суздаль') : cityPlaces).filter(x => x.kind === 'food');
    if (day === 2) {
      const returnAt = cursor;
      stops.push({type:'travel',name:'Кидекша → Суздаль',cn:'基杰克沙 → 苏兹达尔', start:time(returnAt),end:time(returnAt+25)});
      cursor += 45;
    }
    cursor = Math.max(cursor, 720);
    const lunch = lunchSearch.find(add);
    const afternoon = day !== 2 ? visits.filter(x => !morning || x.id !== morning.id).find(add) : null;
    const hotel = day < settings.days - 1 ? cityPlaces.filter(x => x.kind === 'stay').find(add) : null;

    for (const place of cityPlaces) {
      const result = assess(place,settings,day);
      if (result.status !== 'ready') issues.push({ id:place.id, name:place.name, city, ...result });
    }
    const missing = [
      !morning && 'Подтверждённая точка посещения',
      day !== 2 && !afternoon && 'Вторая точка посещения',
      !lunch && 'Место для обеда',
      day < settings.days - 1 && !hotel && 'Ночёвка',
    ].filter(Boolean);
    days.push({ city, date, stops, missing });
  }
  return { settings, days, issues, completeness:days.every(day => day.missing.length === 0) };
}

export function impacts(catalog, state, beforeAudit, beforeWiki) {
  const current = objectsFrom(catalog,state);
  const previous = objectsFrom(catalog,{...state,audit:beforeAudit,wiki:beforeWiki});
  return [...trackedRoutes,...(state.savedRoutes ?? [])].map(route => {
    const baseline = route.baseline ?? planRoute(previous,route.settings);
    const updated = planRoute(current,route.settings);
    const initial = baseline.days.flatMap(day => day.stops.filter(stop => stop.id));
    const revised = updated.days.flatMap(day => day.stops.filter(stop => stop.id));
    const removed = initial.filter(stop => !revised.some(x => x.id === stop.id));
    const added = revised.filter(stop => !initial.some(x => x.id === stop.id));
    const shifted = revised.filter(stop => initial.some(x=>x.id===stop.id && (x.start!==stop.start || x.end!==stop.end)));
    return { id:route.id,title:route.title,subtitle:route.subtitle,settings:route.settings,
      removed, added, shifted, affected:removed.length > 0 || added.length > 0 || shifted.length > 0,
      issues:updated.issues.filter(issue => removed.some(x => x.id === issue.id)) };
  });
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
