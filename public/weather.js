import { addLocaleMessages, formatDate, formatNumber, t } from '/locale.js';

addLocaleMessages([
  ['Погода','Weather','天气'],
  ['Прогноза пока нет','No forecast yet','暂无天气预报'],
  ['Загружаем прогноз погоды…','Loading the weather forecast…','正在加载天气预报…'],
  ['На эту дату прогноз ещё недоступен. Сервис показывает ближайшие {days} дней.',
    'The forecast is not available for this date yet. The service shows the next {days} days.','该日期暂无预报。系统提供未来 {days} 天的天气预报。'],
  ['Дата уже прошла.','This date has passed.','该日期已过。'],
  ['Прогноз сейчас недоступен.','The forecast is currently unavailable.','当前无法获取天气预报。'],
  ['Ясно','Clear','晴'],
  ['Облачно','Cloudy','多云'],
  ['Туман','Fog','雾'],
  ['Дождь','Rain','雨'],
  ['Снег','Snow','雪'],
  ['Ледяные осадки','Freezing precipitation','冻雨或冰粒'],
  ['Гроза','Thunderstorms','雷暴'],
  ['Вероятность осадков до {percent}','Chance of precipitation up to {percent}','降水概率最高 {percent}'],
  ['Порывы до {speed} км/ч','Gusts up to {speed} km/h','阵风最高 {speed} 公里/小时'],
  ['Возможны осадки','Possible precipitation','可能降水'],
  ['Сильный ветер','Strong winds','强风'],
  ['Возможна гроза','Possible thunderstorms','可能出现雷暴'],
  ['Риск гололёда','Risk of ice','道路可能结冰'],
  ['Жара','Hot weather','高温'],
  ['Мороз','Freezing temperatures','低温'],
  ['Риск для программы','Conditions to review','行程天气风险'],
  ['Повышенный риск','Elevated risk','较高风险'],
  ['Для остановок на улице подберите вариант в помещении и подтвердите часы и запись.',
    'For outdoor stops, find an indoor option and confirm opening hours and booking.','为室外停留点准备室内备选，并确认开放时间与预约。'],
  ['Сверьте прогноз и условия на месте перед выездом.',
    'Check the forecast and local conditions before departure.','出发前请复核天气预报和当地条件。'],
  ['Посмотреть замены для «{place}»','Review alternatives to “{place}”','查看“{place}”的替代方案'],
  ['Посмотреть другой вариант программы','Review another itinerary option','查看另一行程方案'],
  ['Проверено {time}','Checked {time}','核查时间 {time}'],
]);

const conditions = {clear:'Ясно',cloudy:'Облачно',fog:'Туман',rain:'Дождь',snow:'Снег',freezing:'Ледяные осадки',thunder:'Гроза'};
const reasons = {wet:'Возможны осадки','strong-wind':'Сильный ветер',thunder:'Возможна гроза',ice:'Риск гололёда',heat:'Жара',cold:'Мороз'};
const escapeHtml = value=>String(value ?? '').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const entries = new Map();
const forecastCacheMs = 10 * 60 * 1000;
const pointsFor = days => days.map(({date,coordinates})=>({date,latitude:coordinates?.[0]??null,longitude:coordinates?.[1]??null}));
const checkedTime = day => Number.isFinite(Date.parse(day.checkedAt)) ? t('Проверено {time}',{
  time:formatDate(day.checkedAt,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC',timeZoneName:'short'}),
}) : '';
const sourceUrl = source => source?.url==='https://open-meteo.com/' ? source.url : '';

export function weatherSlot(index,{compact=false}={}) {
  return '<div class="day-weather caption" data-weather-day="'+index+'"'+(compact?' data-weather-compact':'')+'></div>';
}

function temperature(value) {
  return formatNumber(value,{style:'unit',unit:'celsius',maximumFractionDigits:0});
}

export function weatherSummary(day, horizonDays, compact=false) {
  if (day?.status==='past') return t('Дата уже прошла.');
  if (day?.status==='out-of-range') return t('На эту дату прогноз ещё недоступен. Сервис показывает ближайшие {days} дней.',{days:formatNumber(horizonDays)});
  if (day?.status!=='forecast') return t('Прогноз сейчас недоступен.');
  const spread = [day.lowC,day.highC].filter(Number.isFinite);
  const temperatures = spread.length===2 && spread[0]!==spread[1] ? spread.map(temperature).join(' – ') : spread.map(temperature)[0];
  return [conditions[day.condition] && t(conditions[day.condition]),temperatures,
    !compact && Number.isFinite(day.precipitationChance) && t('Вероятность осадков до {percent}',{percent:formatNumber(day.precipitationChance/100,{style:'percent'})}),
    !compact && Number.isFinite(day.gustKmh) && t('Порывы до {speed} км/ч',{speed:formatNumber(day.gustKmh,{maximumFractionDigits:0})}),
  ].filter(Boolean).join(' · ') || t('Прогноз сейчас недоступен.');
}

function weatherRisk(day, outdoors) {
  if (day.risk!=='high' && !(day.risk==='watch' && outdoors)) return null;
  const issues = (day.reasons ?? []).filter(reason=>Object.hasOwn(reasons,reason)).map(reason=>t(reasons[reason])).join(' · ');
  return {label:t(day.risk==='high'?'Повышенный риск':'Риск для программы'),issues,
    action:t(outdoors?'Для остановок на улице подберите вариант в помещении и подтвердите часы и запись.':
      'Сверьте прогноз и условия на месте перед выездом.')};
}

export function weatherExport(days) {
  const entry=entries.get(JSON.stringify(pointsFor(days)));
  const result=entry?.value;
  return days.map((context,index)=>{
    const day=result?.days?.[index];
    if (day?.status!=='forecast' || day.date!==context.date) return [];
    const risk=weatherRisk(day,context.outdoors);
    const source=[sourceUrl(result.source),checkedTime(day)].filter(Boolean).join(' · ');
    return [t('Погода')+' · '+weatherSummary(day,result.horizonDays),
      ...(risk ? [[risk.label,risk.issues,risk.action].filter(Boolean).join(' · ')] : []),...(source?[source]:[])];
  });
}

function weatherView(element, day, source, horizonDays, context, index) {
  const status = day?.status ?? 'unavailable';
  element.dataset.weatherStatus = status;
  const summary = '<p><strong>'+t('Погода')+'</strong> · '+escapeHtml(weatherSummary(day,horizonDays))+'</p>';
  const compact = element.hasAttribute('data-weather-compact');
  if (status!=='forecast') {
    element.innerHTML=compact ? '<p>'+t('Погода')+' · '+t('Прогноза пока нет')+'</p>' : summary;
    return;
  }
  const attribution = sourceUrl(source) ? '<a target="_blank" rel="noopener noreferrer" href="'+sourceUrl(source)+'">Open-Meteo</a>' : '';
  const detail = [attribution,escapeHtml(checkedTime(day))].filter(Boolean).join(' · ');
  const risk = weatherRisk(day,context.outdoors);
  const suggestion = risk ? context.alternative : null;
  const alternative = suggestion ? '<button type="button" class="link-button day-weather-alternative"'+(suggestion.stop ?
    ' data-composer="weather-alternatives" data-value="'+escapeHtml(suggestion.stop.id)+'" data-day="'+index+'">'+
      escapeHtml(t('Посмотреть замены для «{place}»',{place:suggestion.name})) :
    ' data-action="select-variant" data-variant="'+escapeHtml(suggestion.variant)+'">'+t('Посмотреть другой вариант программы'))+'</button>' : '';
  const riskMarkup=(risk ? '<div class="day-weather-risk"><p><strong>'+risk.label+
    '</strong>'+(risk.issues?' · '+escapeHtml(risk.issues):'')+'</p><p>'+risk.action+'</p>'+alternative+'</div>' : '')+
    (detail?'<p class="day-weather-source">'+detail+'</p>':'');
  if (compact) {
    const shortSummary = [t('Погода'),weatherSummary(day,horizonDays,true),risk?.label].filter(Boolean).join(' · ');
    element.innerHTML='<details><summary>'+escapeHtml(shortSummary)+'</summary>'+summary+riskMarkup+'</details>';
  } else element.innerHTML=summary+riskMarkup;
}

export function loadPlanWeather(container, days, api) {
  const slots = Array.from(container?.querySelectorAll('[data-weather-day]') ?? []);
  if (!slots.length) return;
  const points = pointsFor(days);
  const key = JSON.stringify(points);
  const now=Date.now();
  let entry=entries.get(key);
  if (!entry || (!entry.pending && now>=entry.expiresAt)) {
    if (entries.size>=32) entries.delete(entries.keys().next().value);
    entry={pending:true};
    entries.set(key,entry);
    entry.result=api('weather',{points},'POST').catch(()=>null).then(result=>{
      entry.pending=false;
      entry.value=result;
      entry.expiresAt=Date.now()+(result?.days?.some(day=>day.status==='unavailable') || !result ? 30_000 : forecastCacheMs);
      return result;
    });
  }
  const render = result=>{
    for (const element of slots) {
      const index=Number(element.dataset.weatherDay);
      if (!element.isConnected || !days[index]) continue;
      const day = result?.days?.[index];
      weatherView(element,day?.date===days[index].date?day:null,result?.source,result?.horizonDays??7,days[index],index);
    }
  };
  if (entry.pending) {
    for (const element of slots) element.textContent=t(element.hasAttribute('data-weather-compact')?'Погода':'Загружаем прогноз погоды…');
    void entry.result.then(render);
  } else render(entry.value);
}
