import { addLocaleMessages, formatDate, formatNumber, getLocale, t } from '/locale.js';

addLocaleMessages([
  ['Групповые форматы на маршруте','Group services along the route','沿途团体服务'],
  ['Размер группы по условиям поставщика · {range} чел.','Group size in the published terms · {range} people','供应商公布的团队规模 · {range} 人'],
  ['Время на обед в плане · {minutes} мин','Lunch slot in the itinerary · {minutes} min','行程午餐时段 · {minutes} 分钟'],
  ['Один сеанс · {minutes} мин','One session · {minutes} min','单场服务 · {minutes} 分钟'],
  ['Размер группы подходит','Group size is within range','团队人数符合范围'],
  ['Размер группы вне диапазона','Group size outside the published range','团队人数超出公布的范围'],
  ['Подгруппы · {groups} чел.','Subgroups · {groups} people','分组人数 · {groups} 人'],
  ['Последовательные сеансы · {minutes} мин','Consecutive sessions · {minutes} min','连续场次 · {minutes} 分钟'],
  ['В плане нужно ещё от {minutes} мин','Allow at least {minutes} more min in the itinerary','行程至少还需预留 {minutes} 分钟'],
  ['Согласуйте время и наличие мест у поставщика.','Confirm the time and availability with the provider.','请向供应商确认时间及可用名额。'],
  ['Условия поставщика','Provider terms','供应商条件'],
]);

const escape = value=>String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const local = (label,vars)=>escape(t(label,vars));
const range = values=>[...new Set(values)].map(value=>formatNumber(value)).join('–');

export function groupServiceMarkup(items) {
  if (!items?.length) return '';
  const locale = getLocale();
  return '<details class="draft-group-services"><summary>'+local('Групповые форматы на маршруте')+'</summary>'+items.map(item=>{
    const {venue,service,slotMinutes,singleFits,split}=item;
    const venueName = (locale==='en'?venue.en:locale==='zh'?venue.cn:venue.name) ?? venue.name;
    const extraMinutes = slotMinutes===null ? 0 : (split?.minutes[0] ?? (singleFits ? service.minutes[0] : 0))-slotMinutes;
    return '<section><h4><span data-source-text>'+escape(venueName)+'</span> · '+escape(service.title[locale])+'</h4>'+
      '<p class="caption">'+escape(formatDate(item.date))+' · <a href="'+escape(service.url)+
      '" target="_blank" rel="noopener noreferrer">'+local('Условия поставщика')+'</a></p>'+
      '<p>'+local('Размер группы по условиям поставщика · {range} чел.',{range:range(service.size)})+'</p>'+
      (slotMinutes!==null ? '<p>'+local('Время на обед в плане · {minutes} мин',{minutes:formatNumber(slotMinutes)})+'</p>':'')+
      '<ul><li><strong>'+local('Один сеанс · {minutes} мин',{minutes:range(service.minutes)})+'</strong><span class="caption">'+
      local(singleFits?'Размер группы подходит':'Размер группы вне диапазона')+'</span></li>'+
      (split?'<li><strong>'+local('Подгруппы · {groups} чел.',{groups:split.groups.map(value=>formatNumber(value)).join(' + ')})+'</strong>'+
        '<span class="caption">'+local('Последовательные сеансы · {minutes} мин',{minutes:range(split.minutes)})+'</span></li>':'')+'</ul>'+
      (extraMinutes>0?'<p>'+local('В плане нужно ещё от {minutes} мин',{minutes:formatNumber(extraMinutes)})+'</p>':'')+
      '<p class="caption">'+local('Согласуйте время и наличие мест у поставщика.')+'</p></section>';
  }).join('')+'</details>';
}
