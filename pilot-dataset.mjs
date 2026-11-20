import { defaultRoute, routeDirections, planRoute, routeSettings, region, kindNames, clockTime } from './engine.mjs';

const weekdays = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const tagNames = {
  heritage:'Наследие', museum:'Музеи', family:'Семейный формат', romantic:'Романтический формат',
  nature:'Природа', hike:'Пеший маршрут', craft:'Ремёсла', pilgrimage:'Паломничество',
};
const workbookNames = {routes:'Маршруты и объекты МАГ',diagnostics:'Диагностическая карта МАГ'};
const headers = [
  'ID', 'Регион', 'Город', 'Объект', 'Тип', 'Теги', 'Источник объекта', 'Wikidata',
  'Происхождение в материалах МАГ', 'Откуда переезд', 'Плановый переезд до города, мин', 'Сценарий переезда',
  'Статус опубликованных сведений', 'Дата сверки публикаций', 'График с', 'График по',
  'График и исключения', 'Источник графика', 'Запись', 'Источник записи',
  'Лимиты и условия отдельных услуг', 'Примечания из публикаций', 'Что уточнить перед поездкой',
];

function plannedArrivals() {
  const arrivals = new Map();
  for (const direction of routeDirections) {
    const settings = routeSettings({...defaultRoute,direction:direction.id,days:3});
    const {days} = planRoute([],settings);
    for (const day of days) {
      // The first transfer into the day's city is the inbound leg. Returns for lunch are not arrivals.
      const first = day.stops[0];
      if (first?.type!=='travel' || arrivals.has(day.city)) continue;
      const [from] = first.name.split(' → ');
      const [hours, minutes] = first.start.split(':').map(Number);
      const [endHours, endMinutes] = first.end.split(':').map(Number);
      arrivals.set(day.city,{from:first.from ?? from,minutes:(endHours-hours)*60+endMinutes-minutes,scenario:direction.title});
    }
  }
  return arrivals;
}

const textList = values => values.filter(Boolean).join(' · ');
const windowText = windows => windows.map(([open,close])=>clockTime(open)+'–'+clockTime(close)).join(', ') || 'закрыто';

function scheduleText(schedule) {
  if (!schedule) return '';
  const weekly = schedule.weekly.map((windows,index)=>weekdays[index]+' '+windowText(windows)).join(', ');
  const exceptions = Object.entries(schedule.overrides ?? {}).sort().map(([date,windows])=>date+' '+windowText(windows));
  return textList([schedule.label,weekly,exceptions.length && 'Исключения: '+exceptions.join(', '),
    schedule.lastEntryMinutes && 'Предел входа за '+schedule.lastEntryMinutes+' мин до закрытия',schedule.note]);
}

function bookingText(booking) {
  if (!booking) return '';
  return textList([booking.text,booking.advanceDays && 'Подача заявки минимум за '+booking.advanceDays+' дн.',
    booking.validFrom && 'Действует '+booking.validFrom+' — '+booking.validUntil,booking.termsUrl]);
}

const cite = ({text,url}) => text+' ('+url+')';
const serviceFact = service => cite({
  text:service.title.ru+' — '+service.size.join('–')+' чел., '+service.minutes.join('–')+' мин, сверено '+service.checkedAt,
  url:service.url,
});

function csvCell(value) {
  const text = String(value ?? '');
  // Guard against spreadsheet programs interpreting imported text as a formula.
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text) ? "'"+text : text;
  return '"'+safe.replaceAll('"','""')+'"';
}

export function pilotDatasetCsv(catalog, published, references) {
  const arrivals = plannedArrivals();
  const rows = catalog.map(place=>{
    const official = published[place.id];
    const arrival = arrivals.get(place.city);
    const tags = [...new Set([place.theme,...(place.formats ?? [])])].map(tag=>tagNames[tag] ?? tag);
    const mag = (references[place.id] ?? []).map(ref=>
      workbookNames[ref.workbook]+', лист «'+ref.sheet+'», строки '+ref.rows.join(', ')+' ('+ref.relation+')');
    const {schedule, booking, limits = [], notes = [], groupServices = [], clarify = []} = official ?? {};
    return [
      place.id, region, place.city, place.name, kindNames[place.kind], textList(tags), place.url, place.qid, textList(mag),
      arrival?.from, arrival?.minutes, arrival?.scenario ?? (place.city==='Владимир' ? 'Начало программы во Владимире' : ''),
      official ? 'Есть опубликованные сведения' : 'Требуется сверка условий', official?.checkedAt,
      schedule?.validFrom, schedule?.validUntil, scheduleText(schedule), schedule?.url, bookingText(booking), booking?.url,
      textList([...limits.map(cite),...groupServices.map(serviceFact)]), textList(notes.map(cite)),
      textList(clarify) || 'Уточнить график, запись, лимит группы и необходимые условия на дату посещения.',
    ];
  });
  return '\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(';')).join('\n')+'\n';
}
