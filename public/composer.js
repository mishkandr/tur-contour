import { createRouteMap } from '/map.js';
import { addLocaleMessages, formatDate, formatNumber, getLocale, t } from '/locale.js';

addLocaleMessages([
  ['Конструктор маршрутов','Itinerary builder','行程编制'],
  ['По России','Across Russia','俄罗斯全境'],
  ['Владимирская область · проверка','Vladimir Oblast · verification','弗拉基米尔州 · 核查'],
  ['Опишите, что нужно группе','Describe what the group needs','描述团队需求'],
  ['Разобрать запрос с ИИ','Extract requirements with AI','用人工智能提取需求'],
  ['Разбираем запрос…','Reading the request…','正在解析需求…'],
  ['Например: Казань на три дня, 12 человек, музеи и неспешные прогулки','For example: three days in Kazan, 12 people, museums and relaxed walks','例如：喀山三日，12人，博物馆与轻松步行'],
  ['Параметры маршрута','Itinerary requirements','行程参数'],
  ['Город начала','Starting city','起点城市'],
  ['Название города','City name','城市名称'],
  ['Выберите город','Choose a city','请选择城市'],
  ['Город не найден. Попробуйте другое написание.','City not found. Try a different spelling.','未找到城市，请尝试其他写法。'],
  ['Дата начала','Start date','开始日期'],
  ['Размер группы','Group size','团队人数'],
  ['Длительность','Duration','天数'],
  ['{days} дня','{days} days','{days} 天'],
  ['Темы и ограничения','Interests and constraints','主题与限制'],
  ['Транспорт','Transport','交通方式'],
  ['Пешком','Walking','步行'],
  ['Смешанный','Mixed transport','混合交通'],
  ['Автомобиль или автобус','Car or coach','汽车或巴士'],
  ['Темп','Pace','节奏'],
  ['Закончить посещения до','Finish visits by','参观截止时间'],
  ['Примеры запросов','Sample requests','需求示例'],
  ['История и музеи · Казань','History and museums · Kazan','历史与博物馆 · 喀山'],
  ['Семейная поездка · Москва','Family itinerary · Moscow','亲子行程 · 莫斯科'],
  ['Прогулки у моря · Владивосток','Coastal walks · Vladivostok','海边漫步 · 符拉迪沃斯托克'],
  ['Два города · Москва и Казань','Two cities · Moscow and Kazan','双城行程 · 莫斯科和喀山'],
  ['Неспешный','Relaxed','轻松'],
  ['Обычный','Regular','常规'],
  ['Насыщенный','Packed','紧凑'],
  ['Обязательные объекты','Required places','必到地点'],
  ['Названия через запятую','Names separated by commas','用逗号分隔名称'],
  ['Китайскоязычное сопровождение','Chinese-language support','中文服务'],
  ['Безбарьерный доступ','Step-free access','无障碍通行'],
  ['Собрать черновик','Build draft','生成草案'],
  ['Подбираем точки…','Finding places…','正在查找地点…'],
  ['Требования извлечены. Проверьте поля.','Requirements extracted. Review the fields.','已提取需求，请核对字段。'],
  ['Поля заполнены. ИИ ещё уточняет запрос.','Fields filled. AI is still refining the request.','字段已填写，人工智能仍在细化需求。'],
  ['ИИ разобрал запрос. Проверьте поля.','AI interpreted the request. Review the fields.','人工智能已解析需求，请核对字段。'],
  ['Параметры заполнены автоматически. ИИ сейчас недоступен.','Fields filled automatically. AI is currently unavailable.','已自动填写参数，人工智能暂不可用。'],
  ['Найдено несколько городов. Укажите начальный город.','Several cities found. Choose the starting city.','找到多个城市，请选择起点城市。'],
  ['Запрошено {days} дней. Здесь можно собрать программу на 2 или 3 дня.','Your request specifies {days} days. Choose a two- or three-day draft.','需求为 {days} 天，您可选择生成两天或三天行程。'],
  ['Типы посещений','Visit types','参观类型'],
  ['История и архитектура','History and architecture','历史与建筑'],
  ['Музеи','Museums','博物馆'],
  ['Семейная поездка','Family itinerary','亲子行程'],
  ['Романтическая поездка','Romantic itinerary','浪漫行程'],
  ['Природа','Nature','自然'],
  ['Пеший маршрут','Hiking and walking','徒步'],
  ['Ремёсла','Crafts','工艺'],
  ['Паломничество','Pilgrimage','朝圣'],
  ['Черновик','Draft','草案'],
  ['Карта черновика','Draft map','行程草案地图'],
  ['Целиком','Fit itinerary','显示全程'],
  ['Все дни','All days','所有日期'],
  ['Темы','Interests','主题'],
  ['Исключить типы посещений','Exclude visit types','排除参观类型'],
  ['Учтённые темы','Requested interests covered','已覆盖的主题'],
  ['{count} точек','{count} places','{count} 个地点'],
  ['Подходящие точки не найдены','No matching places found','未找到符合条件的地点'],
  ['Исключено по требованиям','Excluded by requirements','按要求排除'],
  ['По данным карты безбарьерного доступа нет','Map data marks this place as inaccessible','地图数据标记此地点无法无障碍通行'],
  ['Часть посещений не помещается до {time}. Уточните время или уменьшите число остановок.',
    'Some visits do not fit before {time}. Adjust the cut-off or reduce the number of stops.',
    '部分参观无法在 {time} 前完成，请调整截止时间或减少停靠点。'],
  ['Для части выбранных территорий картографический источник не вернул объекты.',
    'The mapping source returned no places for some selected locations.','部分所选地区的地图数据未返回地点。'],
  ['Используется сохранённая выборка точек.','Using a saved collection of places.','当前使用已保存的地点集合。'],
  ['Указана прямая дистанция между городами. Время выезда и прибытия согласуйте отдельно.',
    'The intercity distance is straight-line. Confirm departure and arrival times separately.','城际距离为直线距离，请另行确认出发和抵达时间。'],
  ['Проверка условий','Check conditions','核查条件'],
  ['Открыть первоисточник','Open original source','查看原始来源'],
  ['Ориентировочное время','Estimated time','预估时间'],
  ['Скачать черновик','Download draft','下载草案'],
  ['Сделать обязательным','Mark as required','设为必到地点'],
  ['Исключить точку','Exclude this place','排除此地点'],
  ['Исключённые точки','Excluded places','已排除的地点'],
  ['Вернуть {place}','Restore {place}','恢复 {place}'],
  ['Черновик пересчитан','Draft recalculated','草案已重新计算'],
  ['Чтобы учесть изменения, пересчитайте черновик.','Recalculate the draft to apply the changes.','请重新计算草案以应用变更。'],
  ['Параметры изменились. Соберите черновик заново.','Requirements changed. Rebuild the draft.','参数已更改，请重新生成草案。'],
  ['Точки по данным OpenStreetMap','Places from OpenStreetMap','地点来源 OpenStreetMap'],
  ['Картографические данные недоступны','Map data unavailable','地图数据暂不可用'],
  ['Сохранённый снимок','Saved snapshot','已保存的数据快照'],
  ['Внешний источник','External source','外部数据源'],
  ['Поиск объектов недоступен','Place search unavailable','地点搜索暂不可用'],
  ['Другие города маршрута','Other cities in the itinerary','行程中的其他城市'],
  ['Удалить {city}','Remove {city}','移除 {city}'],
  ['Несколько городов найдено в тексте. Проверьте порядок.','Several cities were found in the request. Check their order.','需求中识别出多个城市，请核对顺序。'],
  ['Городов больше, чем дней. Уберите лишние города или увеличьте длительность.','There are more cities than days. Remove a city or extend the itinerary.','城市数多于行程天数，请移除多余城市或延长行程。'],
  ['{from} → {to} · {distance} км по прямой','{from} → {to} · {distance} km in a straight line','{from} → {to} · 直线距离 {distance} 公里'],
  ['Междугородний переезд нужно подтвердить.','Intercity transport must be confirmed.','城际交通需要另行确认。'],
  ['Подбор объектов','Place selection','地点筛选'],
  ['Объект не попал в расписание','Place could not be scheduled','此地点未能列入行程'],
  ['Объект не найден в данных','Place was not found in the data','数据中未找到此地点'],
  ['Объект включён','Place included','已加入地点'],
  ['Время остановок и переездов ориентировочное. Для группы нужно подтвердить график, вместимость, питание, размещение и запись.',
    'Times and transfers are estimates. Confirm opening hours, capacity, meals, accommodation and reservations for the group.',
    '停留与交通时间为估算。请确认开放时间、接待能力、餐饮、住宿及预约。'],
  ['Картографический источник не вернул объекты для этой территории.','The mapping source returned no places for this area.','此地区的地图数据未返回地点。'],
  ['Используется сохранённый снимок OpenStreetMap.','Using a saved OpenStreetMap snapshot.','当前使用已保存的 OpenStreetMap 数据。'],
  ['Доступность входов, туалетов и перемещений между точками требует отдельной проверки.','Check step-free entrances, toilets and transfers separately.','请另外核查无障碍出入口、卫生间与各地点间的通行条件。'],
  ['Китайскоязычное сопровождение, перевод и питание для группы необходимо подтвердить.','Confirm Chinese-language assistance, interpreting and meals for the group.','请确认团队的中文服务、翻译及餐饮。'],
  ['Подобрать первую точку посещения.','First visit stop still needs to be selected.','尚未选定第一处参观地点。'],
  ['Подобрать вторую точку посещения.','Second visit stop still needs to be selected.','尚未选定第二处参观地点。'],
  ['Подобрать и согласовать обед для группы.','Lunch for the group still needs to be arranged.','团队午餐尚待安排确认。'],
  ['Подобрать и согласовать размещение группы.','Group accommodation still needs to be arranged.','团队住宿尚待安排确认。'],
]);

const themes = {heritage:'История и архитектура',museum:'Музеи',family:'Семейная поездка',romantic:'Романтическая поездка',
  nature:'Природа',hike:'Пеший маршрут',craft:'Ремёсла',pilgrimage:'Паломничество'};
const kind = {visit:'Посещение',food:'Питание',stay:'Размещение'};
const safe = value=>String(value ?? '').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const tr = (value,vars)=>safe(t(value,vars));
const name = item=>getLocale()==='zh' ? item.cn || item.name : getLocale()==='en' ? item.en || item.name : item.name;
const regionName = city=>getLocale()==='zh' ? city.regionCn || city.region : getLocale()==='en' ? city.regionEn || city.region : city.region;
const currentDate = ()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'});
const examples = [
  ['История и музеи · Казань',
    ['Казань на три дня, 12 человек. История и музеи, неспешный темп. Обязательно «Казанский кремль».',
      'Three days in Kazan for 12 people. History and museums at a relaxed pace. Include “Kazan Kremlin”.',
      '喀山三天，12人，历史与博物馆，节奏轻松。必须参观“喀山克里姆林宫”。']],
  ['Семейная поездка · Москва',
    ['Два дня в Москве для 8 человек, семейная программа с парками, нужен безбарьерный доступ.',
      'Two days in Moscow for 8 people, family itinerary with parks and step-free access.',
      '莫斯科两天，8人，亲子公园行程，需要无障碍通行。']],
  ['Прогулки у моря · Владивосток',
    ['Владивосток, два дня для 6 человек. Природа и пешие прогулки до обеда.',
      'Two days in Vladivostok for 6 people. Nature and walking before lunch.',
      '符拉迪沃斯托克两天，6人，自然和徒步，中午前结束参观。']],
  ['Два города · Москва и Казань',
    ['Москва и Казань на три дня для 12 человек, музеи, на автомобиле.',
      'Moscow and Kazan for three days, 12 people, museums and travel by car.',
      '莫斯科和喀山三天，12人，博物馆，自驾。']],
];
const state = {
  brief:'',lastAppliedBrief:'',query:'',cities:[],selectedCity:null,extraCities:[], settings:{date:currentDate(),days:2,size:8,interests:[],transport:'mixed',
    pace:'normal',market:'ru',access:false,required:[],excludedInterests:[],visitDeadline:null}, result:null,mapDay:'all',point:null,dirty:false,
  revision:0,note:'',noteValues:null, parsePending:false, findVersion:0, buildPending:false,pointDay:null,
  omitted:[],
};
const cacheKey='tur-contour.current-draft.v1';
try {
  const saved=JSON.parse(sessionStorage.getItem(cacheKey)??'null');
  if (saved?.settings && saved?.result?.plan?.days?.length) {
    Object.assign(state,saved,{parsePending:false,buildPending:false});
  }
} catch { /* A disabled or full session store leaves the current page usable. */ }

function retainDraft() {
  if (!state.result) return;
  const {brief,lastAppliedBrief,query,cities,selectedCity,extraCities,settings,result,mapDay,point,pointDay,dirty,omitted} = state;
  try {sessionStorage.setItem(cacheKey,JSON.stringify({brief,lastAppliedBrief,query,cities,selectedCity,extraCities,settings,result,mapDay,point,pointDay,dirty,omitted}));}
  catch { /* The open draft remains available in memory. */ }
}

const options = (choices,current)=>Object.entries(choices).map(([value,label])=>'<option value="'+safe(value)+'"'+
  (String(current)===value?' selected':'')+'>'+tr(label)+'</option>').join('');

export function itineraryTabs(pilot) {
  return '<nav class="itinerary-tabs" aria-label="'+tr('Конструктор маршрутов')+'"><a href="#route"'+(!pilot?' aria-current="page"':'')+'>'+
    tr('По России')+'</a><a href="#route?scope=pilot"'+(pilot?' aria-current="page"':'')+'>'+tr('Владимирская область · проверка')+'</a></nav>';
}

function formMarkup() {
  const settings = state.settings;
  return '<div class="composer-inputs"><form id="brief-input" class="panel composer-brief">'+
    '<label class="field"><span>'+tr('Опишите, что нужно группе')+'</span><textarea name="brief" rows="3" minlength="3" maxlength="600" required placeholder="'+
    tr('Например: Казань на три дня, 12 человек, музеи и неспешные прогулки')+'">'+safe(state.brief)+'</textarea></label>'+
    '<button type="submit" class="button"'+(state.parsePending?' disabled':'')+'>'+tr(state.parsePending?'Разбираем запрос…':'Разобрать запрос с ИИ')+'</button>'+
    '<p id="brief-status" class="caption" role="status">'+(state.note ? tr(state.note,state.noteValues) : '')+'</p>'+
    '<details class="brief-examples"><summary>'+tr('Примеры запросов')+'</summary><ul>'+examples.map(([label],index)=>
      '<li><button class="button-quiet" type="button" data-composer="example" data-value="'+index+'">'+tr(label)+'</button></li>').join('')+
    '</ul></details></form>'+
    '<form id="draft-input" class="panel composer-form"><h2>'+tr('Параметры маршрута')+'</h2>'+
    '<label class="field composer-city"><span>'+tr('Город начала')+'</span><input id="city-query" type="search" value="'+
    safe(state.query)+'" placeholder="'+tr('Название города')+'" autocomplete="off" aria-controls="city-results"></label>'+
    '<div id="city-results"></div><div id="draft-additional-cities"></div><div id="draft-omitted"></div>'+
    '<div class="composer-fields"><label class="field">'+tr('Дата начала')+'<input type="date" name="date" value="'+safe(settings.date)+'" required></label>'+
    '<label class="field">'+tr('Длительность')+'<select name="days">'+[2,3].map(day=>'<option value="'+day+'"'+(settings.days===day?' selected':'')+'>'+
    tr('{days} дня',{days:day})+'</option>').join('')+'</select></label>'+
    '<label class="field">'+tr('Размер группы')+'<input type="number" name="size" value="'+settings.size+'" min="1" max="100" required></label></div>'+
    '<details id="draft-advanced"><summary>'+tr('Темы и ограничения')+'</summary><fieldset class="composer-themes"><legend>'+tr('Типы посещений')+'</legend>'+
    Object.entries(themes).map(([theme,label])=>'<label class="check"><input type="checkbox" name="interest" value="'+theme+'"'+
      (settings.interests.includes(theme)?' checked':'')+'>'+tr(label)+'</label>').join('')+'</fieldset>'+
    '<details id="draft-exclusions"'+(settings.excludedInterests.length?' open':'')+'><summary>'+tr('Исключить типы посещений')+
    '</summary><fieldset class="composer-themes"><legend class="sr-only">'+tr('Исключить типы посещений')+'</legend>'+
    Object.entries(themes).map(([theme,label])=>'<label class="check"><input type="checkbox" name="excludedInterest" value="'+theme+'"'+
      (settings.excludedInterests.includes(theme)?' checked':'')+'>'+tr(label)+'</label>').join('')+'</fieldset></details>'+
    '<div class="composer-fields"><label class="field">'+tr('Транспорт')+'<select name="transport">'+
    options({mixed:'Смешанный',walking:'Пешком',car:'Автомобиль или автобус'},settings.transport)+'</select></label>'+
    '<label class="field">'+tr('Темп')+'<select name="pace">'+options({normal:'Обычный',relaxed:'Неспешный',dense:'Насыщенный'},settings.pace)+'</select></label>'+
    '<label class="field">'+tr('Обязательные объекты')+'<input name="required" maxlength="400" placeholder="'+tr('Названия через запятую')+
    '" value="'+safe(settings.required.join(', '))+'"></label></div>'+
    '<label class="field composer-visit-deadline">'+tr('Закончить посещения до')+'<input type="time" min="09:00" max="18:00" name="visitDeadline" value="'+
    safe(settings.visitDeadline??'')+'"></label>'+
    '<label class="check"><input type="checkbox" name="china"'+(settings.market==='zh'?' checked':'')+'>'+tr('Китайскоязычное сопровождение')+'</label>'+
    '<label class="check"><input type="checkbox" name="access"'+(settings.access?' checked':'')+'>'+tr('Безбарьерный доступ')+'</label>'+
    '</details><div class="actions"><button type="submit" class="button"'+(state.buildPending?' disabled':'')+'>'+
    tr(state.buildPending?'Подбираем точки…':'Собрать черновик')+'</button></div><p id="draft-status" class="caption" role="status"></p></form></div>';
}

function eligibility(item) {
  return item.scheduled ? 'Объект включён' : item.accessBlocked ? 'По данным карты безбарьерного доступа нет' :
    item.omitted || item.excludedInterests?.length ? 'Исключено по требованиям' :
    item.matched ? 'Объект не попал в расписание' : 'Объект не найден в данных';
}

function gapLabel(message) {
  if (message.startsWith('Согласовать переезд ')) return t('Междугородний переезд нужно подтвердить.');
  const cutoff = /^Часть посещений не помещается до (\d{2}:\d{2})\./u.exec(message);
  return cutoff ? t('Часть посещений не помещается до {time}. Уточните время или уменьшите число остановок.',{time:cutoff[1]}) : t(message);
}

function evidenceSources(result) {
  return (result.sources?.length ? result.sources : [result.source]).flatMap(source=>
    source.supplemental ? [source,{...source.supplemental,city:source.city}] : [source]);
}

function coverageMarkup(coverage) {
  if (!coverage?.length) return '';
  return '<div class="composer-coverage"><h3>'+tr('Учтённые темы')+'</h3><ul>'+coverage.map(({theme,count})=>
    '<li><strong>'+tr(themes[theme]??theme)+'</strong><span class="chip '+(count?'':'warn')+'">'+
    (count?tr('{count} точек',{count:formatNumber(count)}):tr('Подходящие точки не найдены'))+'</span></li>').join('')+'</ul></div>';
}

function draftMarkup(result) {
  const {location,plan,settings} = result;
  const venues = result.locations ?? [location];
  const sources = evidenceSources(result).map(item=>{
    const status = item.status==='live' ? 'Внешний источник' : item.status==='snapshot' ? 'Сохранённый снимок' : 'Поиск объектов недоступен';
    const date = item.checkedAt && Number.isFinite(Date.parse(item.checkedAt)) ? ' · '+formatDate(item.checkedAt) : '';
    return '<li><a href="'+safe(item.url)+'" target="_blank" rel="noopener noreferrer" data-source-text>'+safe(item.name)+'</a>'+
      ' · '+tr(status)+safe(date)+(item.city && venues.length>1?' · '+safe(item.city):'')+'</li>';
  }).join('');
  return '<section class="panel composer-output" aria-labelledby="draft-title"><header class="composer-title"><div><p class="ops-kicker">'+
    tr('Черновик')+'</p><h2 id="draft-title" tabindex="-1" data-source-text>'+safe(venues.map(name).join(' → '))+'</h2><p class="caption">'+
    safe(regionName(location))+' · '+safe(formatDate(settings.date))+' · '+formatNumber(settings.size)+'</p></div><button class="button-quiet" type="button" data-composer="export"'+
    (state.dirty?' disabled':'')+'>'+tr('Скачать черновик')+'</button></header><ul class="caption composer-source">'+sources+
    '<li><a href="'+safe(location.sourceUrl)+'" target="_blank" rel="noopener noreferrer">GeoNames</a></li></ul>'+
    coverageMarkup(plan.interestCoverage)+
    '<div class="composer-map-frame"><div class="atlas-map-top"><div class="atlas-options" id="draft-days" aria-label="'+tr('Дни маршрута')+'"></div>'+
    '<button class="button-quiet" data-composer="fit" type="button">'+tr('Целиком')+'</button></div><div class="composer-map-scene">'+
    '<div id="draft-map" role="region" aria-label="'+tr('Карта черновика')+'"></div></div></div>'+
    '<div id="draft-timeline"></div><section class="composer-evidence"><h3>'+tr('Проверка условий')+'</h3><ul>'+
    result.warnings.map(warning=>'<li>'+tr(warning)+'</li>').join('')+
    plan.required.map(item=>'<li><span data-source-text>'+safe(item.label)+'</span> · '+tr(eligibility(item))+'</li>').join('')+'</ul></section></section>';
}

function download(result) {
  const {location,plan,settings,warnings} = result;
  const lines = [t('Черновик')+' · '+(result.locations??[location]).map(name).join(' → '), formatDate(settings.date)+' · '+formatNumber(settings.size),
    ...evidenceSources(result).map(item=>item.name+' · '+item.url), location.sourceUrl,'',
    ...plan.days.flatMap((day,index)=>[t('День {day}',{day:index+1})+' · '+formatDate(day.date)+' · '+(day.cityId ?
      name(result.locations?.find(item=>item.id===day.cityId)??location):name(location)),
      ...day.stops.map(stop=>stop.start+'–'+stop.end+' '+name(stop)+' · '+stop.url),...day.missing.map(gapLabel),'']),
    t('Проверка условий'),...warnings.map(t),...plan.required.map(item=>item.label+' · '+t(eligibility(item))),
    ...(plan.interestCoverage??[]).map(({theme,count})=>t(themes[theme]??theme)+' · '+
      (count?t('{count} точек',{count:formatNumber(count)}):t('Подходящие точки не найдены')))];
  const file = URL.createObjectURL(new Blob(['\uFEFF',lines.join('\n')],{type:'text/plain;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = file;
  a.download = 'tur-contour-'+settings.date+'-'+getLocale()+'.txt';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(file),1000);
}

export function mountComposer(container, api) {
  const find = selector=>container.querySelector(selector);
  let map;
  let searchTimer;
  let mounted=true;
  container.innerHTML = '<header class="page-head"><h1>'+tr('Конструктор маршрутов')+'</h1></header>'+
    itineraryTabs(false)+'<div class="composer-layout">'+formMarkup()+'<div class="composer-result" id="composer-result"></div></div>';
  function cityOptions(noMatches=false) {
    if (!mounted) return;
    find('#city-results').innerHTML = state.cities.length ? '<label class="field"><span class="sr-only">'+tr('Выберите город')+'</span>'+
      '<select id="city-id" aria-label="'+tr('Выберите город')+'"><option value="">'+tr('Выберите город')+'</option>'+
      state.cities.map(city=>'<option value="'+safe(city.id)+'"'+(city.id===state.selectedCity?.id?' selected':'')+'>'+safe(name(city))+
        (city.region?' · '+safe(regionName(city)):'')+'</option>').join('')+'</select></label>' : noMatches ?
      '<p class="caption" role="status">'+tr('Город не найден. Попробуйте другое написание.')+'</p>':'';
    find('#draft-additional-cities').innerHTML=state.extraCities.length ? '<p class="caption">'+tr('Другие города маршрута')+'</p>'+
      '<ul class="composer-extra">'+state.extraCities.map(city=>'<li><button type="button" class="button-quiet" data-composer="remove-city" data-value="'+safe(city.id)+
      '" aria-label="'+tr('Удалить {city}',{city:name(city)})+'"><span data-source-text>'+safe(name(city))+'</span> <span aria-hidden="true">×</span></button></li>').join('')+'</ul>':'';
    find('#draft-omitted').innerHTML=state.omitted.length ? '<p class="caption">'+tr('Исключённые точки')+'</p>'+
      '<ul class="composer-extra">'+state.omitted.map(place=>'<li><button type="button" class="button-quiet" data-composer="restore-stop" data-value="'+safe(place.id)+
      '" aria-label="'+tr('Вернуть {place}',{place:name(place)})+'"><span data-source-text>'+safe(name(place))+'</span> <span aria-hidden="true">↶</span></button></li>').join('')+'</ul>':'';
  }
  function updateExtraction() {
    if (!mounted) return;
    const fields=find('#draft-input').elements;
    for(const key of ['date','days','size','transport','pace']) fields[key].value=state.settings[key];
    fields.required.value=state.settings.required.join(', ');
    fields.visitDeadline.value=state.settings.visitDeadline??'';
    fields.china.checked=state.settings.market==='zh';
    fields.access.checked=state.settings.access;
    [...find('#draft-input').querySelectorAll('[name=interest]')].forEach(control=>{control.checked=state.settings.interests.includes(control.value);});
    [...find('#draft-input').querySelectorAll('[name=excludedInterest]')].forEach(control=>{control.checked=state.settings.excludedInterests.includes(control.value);});
    if (state.settings.interests.length || state.settings.required.length || state.settings.access || state.settings.visitDeadline ||
        state.settings.excludedInterests.length) find('#draft-advanced').open=true;
    if (state.settings.excludedInterests.length) find('#draft-exclusions').open=true;
    find('#city-query').value=state.query;
    cityOptions();
    find('#brief-status').textContent=state.note?t(state.note,state.noteValues):'';
  }
  function paintDays(frame=false) {
    const {plan,places,geodata} = state.result;
    const days=plan.days.map((day,index)=>({day,index})).filter(({index})=>state.mapDay==='all'||String(index)===state.mapDay);
    const region=find('#draft-days');
    region.innerHTML = [['all',t('Все дни')],...plan.days.map((_day,i)=>[String(i),t('День {day}',{day:i+1})])]
      .map(([key,label])=>'<button class="atlas-option" type="button" data-composer="day" data-value="'+key+'" aria-pressed="'+(state.mapDay===key)+'">'+safe(label)+'</button>').join('');
    const included = new Set(days.flatMap(({day})=>day.stops.map(stop=>stop.id)));
    const visible=places.filter(place=>included.has(place.id));
    find('#draft-timeline').innerHTML = days.map(({day,index})=>'<section class="composer-day"><h3>'+tr('День {day}',{day:index+1})+
      ' · '+safe(formatDate(day.date))+(state.result.locations?.length>1?' · '+safe(name(state.result.locations.find(city=>city.id===day.cityId)??{name:day.city})): '')+
      '</h3>'+(day.transfer ? '<p class="caption">'+tr('{from} → {to} · {distance} км по прямой',{
        from:day.transfer.from?.name??day.transfer.from,to:day.transfer.to?.name??day.transfer.to,distance:formatNumber(day.transfer.distanceKm)})+'</p>' : '')+
      '<ul class="composer-stops">'+day.stops.map(stop=>'<li><button type="button" data-composer="stop" data-value="'+
      safe(stop.id)+'" data-day="'+index+'" aria-pressed="'+(state.point===stop.id && state.pointDay===index)+'"><time>'+safe(stop.start)+'–'+safe(stop.end)+'</time><span data-source-text>'+safe(name(stop))+
      '</span><small>'+tr(kind[stop.type])+'</small></button>'+
      (state.point===stop.id && state.pointDay===index?'<div class="composer-stop-actions"><a href="'+safe(stop.url)+'" target="_blank" rel="noopener noreferrer">'+tr('Открыть первоисточник')+
      '</a><button type="button" class="link-button" data-composer="pin-stop" data-value="'+safe(stop.id)+'">'+tr('Сделать обязательным')+'</button>'+
      '<button type="button" class="link-button" data-composer="omit-stop" data-value="'+safe(stop.id)+'">'+tr('Исключить точку')+'</button></div>':'')+
      '</li>').join('')+
      '</ul>'+day.missing.map(gap=>'<p class="caption">'+safe(gapLabel(gap))+'</p>').join('')+'</section>').join('');
    map?.update({places:visible,route:{...plan,days:days.map(({day})=>day)},selectedId:state.point,
      dayIndex:state.mapDay==='all'?0:Number(state.mapDay),geodata,frame:frame?'route':false,base:'streets',locale:getLocale(),showPlaces:true});
    retainDraft();
  }
  function resultMarkup(focus=false) {
    if (!mounted) return;
    map?.destroy();
    if (!state.result) return;
    find('#composer-result').innerHTML=draftMarkup(state.result);
    map=createRouteMap(find('#draft-map'),{locale:getLocale(),onSelect(id,_place,context){
      state.point=id;
      const day=context?.dayIndex;
      const days=state.result.plan.days;
      state.pointDay=Number.isInteger(day) && days[day]?.stops.some(stop=>stop.id===id) ? day :
        days.findIndex(item=>item.stops.some(stop=>stop.id===id));
      paintDays();
      if (window.matchMedia('(max-width: 760px)').matches) {
        find('#draft-timeline button[aria-pressed=true]')?.scrollIntoView({block:'nearest'});
      }
    }});
    paintDays(true);
    if (focus) find('#draft-title').focus();
    if (state.dirty) find('#draft-status').textContent=t('Параметры изменились. Соберите черновик заново.');
  }
  function settingsFrom(form) {
    const fields=new FormData(form);
    return {date:fields.get('date'),days:Number(fields.get('days')),size:Number(fields.get('size')),interests:fields.getAll('interest'),
      excludedInterests:fields.getAll('excludedInterest'),
      theme:fields.getAll('interest')[0]??'any',transport:fields.get('transport'),pace:fields.get('pace'),
      market:fields.has('china')?'zh':'ru',access:fields.has('access'),visitDeadline:fields.get('visitDeadline')||null,
      required:String(fields.get('required')).split(/[,，;]/u).map(name=>name.trim()).filter(Boolean).slice(0,5)};
  }
  function setDirty() {
    state.revision+=1;
    if (!state.result) return;
    state.dirty=true;
    const send=find('[data-composer=export]');
    if (send) send.disabled=true;
    find('#draft-status').textContent=t('Параметры изменились. Соберите черновик заново.');
  }
  function applyParsing(result,message) {
    const {parsed,cities}=result;
    const resultSettings={};
    for (const key of ['date','days','size','transport','pace','market','access','visitDeadline']) if (parsed[key]!=null) resultSettings[key]=parsed[key];
    resultSettings.interests=parsed.interests;
    resultSettings.required=parsed.required;
    resultSettings.excludedInterests=parsed.excludedInterests??[];
    state.settings={...state.settings,...resultSettings};
    state.lastAppliedBrief=state.brief;
    if (cities.length) {
      state.cities=cities;
      state.selectedCity=cities[0];
      state.extraCities=cities.slice(1,3);
      state.query=name(state.selectedCity);
    }
    if (state.result) state.dirty=true;
    if (state.result && mounted) find('#draft-status').textContent=t('Параметры изменились. Соберите черновик заново.');
    retainDraft();
    state.note = cities.length>1 ? 'Несколько городов найдено в тексте. Проверьте порядок.' :
      parsed.requestedDays && !parsed.days ? 'Запрошено {days} дней. Здесь можно собрать программу на 2 или 3 дня.' : message;
    state.noteValues={days:parsed.requestedDays};
    updateExtraction();
  }
  async function analyse(form) {
    if (state.parsePending) return;
    const submit=form.querySelector('[type=submit]');
    state.parsePending=true;
    submit.disabled=true;
    submit.textContent=t('Разбираем запрос…');
    state.brief=String(new FormData(form).get('brief')).trim();
    const revision=state.revision;
    try {
      const fast=await api('brief',{text:state.brief,mode:'rules'});
      if (state.revision===revision) applyParsing(fast,'Поля заполнены. ИИ ещё уточняет запрос.');
      const deep=await api('brief',{text:state.brief,mode:'ai'});
      if (state.revision===revision) applyParsing(deep,deep.mode==='ai'?'ИИ разобрал запрос. Проверьте поля.':
        'Параметры заполнены автоматически. ИИ сейчас недоступен.');
    } catch(error) {
      if (mounted) find('#brief-status').textContent=t(error.message);
    } finally {
      state.parsePending=false;
      const button = mounted && find('#brief-input [type=submit]');
      if (button) {button.disabled=false;button.textContent=t('Разобрать запрос с ИИ');}
    }
  }
  async function build(form) {
    if (state.buildPending) return;
    const submit=form.querySelector('[type=submit]');
    state.buildPending=true;
    submit.disabled=true;
    submit.textContent=t('Подбираем точки…');
    const revision=++state.revision;
    try {
      if (state.brief.trim().length>=3 && state.brief.trim()!==state.lastAppliedBrief) {
        const fast=await api('brief',{text:state.brief.trim(),mode:'rules'});
        if (state.revision===revision) applyParsing(fast,'Требования извлечены. Проверьте поля.');
        return;
      }
      if (!state.selectedCity && state.query.trim()) {
        const response=await api('cities?q='+encodeURIComponent(state.query));
        state.cities=response.cities;
        const possible=state.cities.filter(city=>[city.name,city.en,city.cn].some(value=>value?.toLowerCase()===state.query.trim().toLowerCase()));
        if (possible.length===1) state.selectedCity=possible[0];
        if (mounted) cityOptions(true);
      }
      if (!state.selectedCity) {
        if (mounted) {
          find('#draft-status').textContent=t('Выберите город');
          (find('#city-id')??find('#city-query')).focus();
        }
        return;
      }
      state.settings=settingsFrom(form);
      if (state.extraCities.length>=state.settings.days) {
        if (mounted) find('#draft-status').textContent=t('Городов больше, чем дней. Уберите лишние города или увеличьте длительность.');
        return;
      }
      const result=await api('draft',{...state.settings,cityId:state.selectedCity.id,additionalCityIds:state.extraCities.map(city=>city.id),
        omittedIds:state.omitted.map(place=>place.id)});
      if (state.revision!==revision) return;
      state.result=result;
      state.mapDay='all';
      state.point=null;
      state.pointDay=null;
      state.dirty=false;
      if (mounted) find('#draft-status').textContent='';
      resultMarkup(true);
    } catch(error) {
      if (mounted) find('#draft-status').textContent=t(error.message);
    } finally {
      state.buildPending=false;
      const button = mounted && find('#draft-input [type=submit]');
      if (button) {button.disabled=false;button.textContent=t('Собрать черновик');}
    }
  }
  const submit = event=>{
    const form=event.target;
    if (form.id==='brief-input') {event.preventDefault();void analyse(form);}
    if (form.id==='draft-input') {event.preventDefault();void build(form);}
  };
  const input = event=>{
    const control=event.target;
    if (control.form?.id==='brief-input') {state.brief=control.value;state.revision+=1;}
    if (control.form?.id!=='draft-input') return;
    setDirty();
    if (control.id==='city-query') {
      state.query=control.value;
      state.selectedCity=null;
      clearTimeout(searchTimer);
      const version=++state.findVersion;
      if (!state.query.trim()) {state.cities=[];cityOptions();return;}
      if (state.query.trim().length<2) return;
      searchTimer=setTimeout(async()=>{
        try {
          const result=await api('cities?q='+encodeURIComponent(state.query));
          if (mounted && state.findVersion===version) {state.cities=result.cities;cityOptions(true);}
        } catch(error) {if (mounted) find('#draft-status').textContent=t(error.message);}
      },250);
    }
    if (control.id==='city-id') {
      const previous=state.selectedCity;
      state.selectedCity=state.cities.find(city=>city.id===control.value)??null;
      if (state.extraCities.some(city=>city.id===state.selectedCity?.id)) {
        state.extraCities=state.extraCities.flatMap(city=>city.id===state.selectedCity.id ? previous?[previous]:[] : [city]);
        cityOptions();
        find('#city-id')?.focus();
      }
      if (state.selectedCity) state.query=find('#city-query').value=name(state.selectedCity);
    }
    state.settings=settingsFrom(find('#draft-input'));
    retainDraft();
  };
  const click = event=>{
    const button=event.target.closest('[data-composer]');
    if (!button) return;
    const {composer:action,value}=button.dataset;
    if (action==='example') {
      const input = find('#brief-input textarea');
      input.value=state.brief=examples[Number(value)][1][{ru:0,en:1,zh:2}[getLocale()]];
      state.revision+=1;
      input.focus();
      return;
    }
    if (action==='remove-city') {
      state.extraCities=state.extraCities.filter(city=>city.id!==value);
      cityOptions();
      setDirty();
      (find('#draft-additional-cities button')??find('#city-query')).focus();
      return;
    }
    if (action==='restore-stop') {
      state.omitted=state.omitted.filter(place=>place.id!==value);
      cityOptions();
      setDirty();
      retainDraft();
      (find('#draft-omitted button')??find('#draft-input [type=submit]')).focus();
      return;
    }
    if (!state.result) return;
    if (action==='day') {
      state.mapDay=value;
      state.point=null;
      state.pointDay=null;
      paintDays(true);
      find('#draft-days [aria-pressed=true]')?.focus({preventScroll:true});
    }
    if (action==='fit') map?.fit({routeOnly:true});
    if (action==='stop') {
      state.point=value;
      state.pointDay=Number(button.dataset.day);
      paintDays();
      map?.select(value,{focus:true});
      find('#draft-timeline button[aria-pressed=true]')?.focus({preventScroll:true});
    }
    if (action==='export' && !state.dirty) download(state.result);
    if (action==='pin-stop'||action==='omit-stop') {
      const place=state.result.places.find(item=>item.id===value);
      if (!place) return;
      const form=find('#draft-input');
      if (action==='pin-stop') {
        const input=form.elements.required;
        const fields=settingsFrom(form);
        input.value=[...new Set([place.name,...fields.required])].slice(0,5).join(', ');
        state.omitted=state.omitted.filter(item=>item.id!==place.id);
        find('#draft-advanced').open=true;
      } else if (!state.omitted.some(item=>item.id===place.id) && state.omitted.length<20) state.omitted.push(place);
      state.settings=settingsFrom(form);
      cityOptions();
      setDirty();
      retainDraft();
      const status=find('#draft-status');
      status.textContent=t('Чтобы учесть изменения, пересчитайте черновик.');
      form.querySelector('[type=submit]').focus();
    }
  };
  container.addEventListener('submit',submit);
  container.addEventListener('input',input);
  container.addEventListener('click',click);
  cityOptions();
  resultMarkup();
  return {destroy(){
    mounted=false;
    clearTimeout(searchTimer);
    map?.destroy();
    container.removeEventListener('submit',submit);
    container.removeEventListener('input',input);
    container.removeEventListener('click',click);
  }};
}
