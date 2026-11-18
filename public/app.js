import { mountAtlas, pilotParameters, readPilotParameters } from '/atlas.js';
import { assess, clockTime, defaultRoute, groupApplicationDeadline, kindNames, months, number, planRoute, previewPublishedRoute, publishedHours, routeSettings, routeDirections, statSummary } from '/engine.mjs';
import { chineseItinerary, chineseItineraryText } from '/chinese-itinerary.mjs';
import { addLocaleMessages, formatDate, formatNumber, getLocale, localeTag, localizeDom, setLocale, t } from '/locale.js';
import { renderMonitoredProgrammes } from '/overview.js';
import { mountCityOverview } from '/city-overview.js';
import { mountComposer } from '/composer.js';
import { aiWaitingMarkup, mountKnowledge, updateAiWait } from '/knowledge.js';
import { loadPlanWeather, weatherSlot } from '/weather.js';
import { mountSourceConsole } from '/source-console.js';

const $ = selector => document.querySelector(selector);
const screen = $('#screen');
const dialog = $('#place-dialog');
const labels = { overview:'Обзор', impact:'Карта объектов', catalog:'Каталог', route:'Маршруты', stats:'Статистика',
  ask:'Вопрос по данным', sources:'Источники' };
const statusText = { ready:'Подходит по условиям', blocked:'Ограничение', unknown:'Требует проверки' };
const routeThemes = {
  heritage:'История и архитектура', museum:'Музеи', romantic:'Романтическая поездка', family:'Семейная поездка',
  hike:'Пеший маршрут', nature:'Природа', craft:'Ремёсла', pilgrimage:'Паломничество', any:'Любой формат',
};
addLocaleMessages([
  ['Начиная с января 2026 года действует обновлённая методика Росстата.','Rosstat uses an updated methodology from January 2026.','俄罗斯统计局自2026年1月起采用更新后的统计方法。'],
  ['Ряды показаны отдельно по годам.','The series are shown separately by year.','各年度数据分别列示。'],
  ['Среднее и темп изменения между периодами с разной методикой не рассчитаны.','No average or change rate is calculated across the two methodologies.','不同统计方法的期间不计算合并平均值或变化率。'],
  ['Месячные значения за {year}.','Monthly values for {year}.','{year} 年的月度数值。'],
  ['Проверка программы','Verify itinerary','核查行程'],
  ['Направление','Direction','路线方向'],
  ['Данные для проверки','Evidence for verification','用于核查的数据'],
  ['Опубликованные и подтверждённые условия','Published and supplier-confirmed conditions','已公布和供应方确认的条件'],
  ['Сопоставить даты, группу и условия','Match dates, group and conditions','核对日期、团队与参观条件'],
  ['Предварительная программа по опубликованным часам','Draft based on published opening hours','按已公布开放时间拟定的草案'],
  ['Время остановок ориентировочное. Для группы подтвердите свободный сеанс, запись и вместимость у поставщиков.',
    'Stop times are indicative. Confirm a slot, booking and capacity for the group with each supplier.',
    '停留时间为估算。请向供应方确认团队时段、预约及接待人数。'],
  ['{kind} · время предложено по опубликованному графику','{kind} · proposed time based on published opening hours','{kind} · 根据已公布时间拟定'],
  ['Срок подачи новой заявки','Deadline for a new application','新申请截止日期'],
  ['Заявка на комплексную экскурсию подаётся до {date} (за {days} дней).','Apply for a guided tour package by {date} ({days} days in advance).','综合导览服务须在 {date} 前提交申请（提前 {days} 天）。'],
  ['Срок новой заявки на комплексную экскурсию истёк {date}. Если заявка уже подана, проверьте её статус.',
    'The deadline for a new guided tour application was {date}. Check the status if you have already applied.','综合导览服务的新申请已于 {date} 截止。如已提交，请核查状态。'],
  ['Оферта музея','Museum booking terms','博物馆申请条款'],
  ['Показан предыдущий расчёт по применённым параметрам. Пересчитайте программу, чтобы сверить расписание и погоду.',
    'Showing the previous result with the applied requirements. Recalculate to review the new schedule and weather.',
    '当前显示上次已应用条件的结果。请重新计算，以核查新的日程和天气。'],
  ['Исправьте дату или размер группы. Каталог пока показывает условия на {date} для группы из {size} чел.',
    'Correct the date or group size. For now the catalogue shows conditions for {size} people on {date}.',
    '请更正日期或团队人数。目录目前显示 {date} 接待 {size} 人的条件。'],
  ['Карта объектов','Map of places','地点地图'],
  ['Дата визита','Visit date','到访日期'],
  ['Все города','All cities','所有城市'],
  ['Город','City','城市'],
  ['Режим','Mode','模式'],
  ['Опубликованные данные','Published data','已公布的数据'],
  ['Учебные данные','Training data','演示数据'],
  ['Группа · {size} чел.','Group · {size} people','团队 · {size} 人'],
  ['Обновлено','Updated','已更新'],
  ['Картографические источники','Mapping sources','地图数据源'],
  ['Города, координаты и часовые пояса','Cities, coordinates and time zones','城市、坐标和时区'],
  ['Места и категории OpenStreetMap по запросу; при сбое — геопоиск Wikimedia и сохранённые записи.',
    'OpenStreetMap places and categories on request, with Wikimedia geosearch and saved records as fallbacks.',
    '按需检索 OpenStreetMap 地点和类别，失败时使用 Wikimedia 地理搜索及已保存的记录。'],
  ['Графики и запись сверяются по паспорту поставщика.','Use the supplier record to check hours and booking.','开放时间及预约请查阅供应方档案。'],
  ['Проверить по опубликованным условиям','Check against published conditions','按已公布条件核查'],
  ['Территория','Area','地区'],
  ['Росстат · месячные ряды средств размещения','Rosstat · monthly accommodation series','俄罗斯统计局 · 住宿业月度序列'],
  ['Загружаем региональный ряд…','Loading regional series…','正在加载地区统计序列…'],
  ['Нет доступных месячных данных для этого субъекта.','No monthly data is available for this federal subject.','该联邦主体暂无可用的月度数据。'],
  ['Лимит запросов к источнику достигнут.','The source request limit has been reached.','已达到数据源的请求上限。'],
  ['Ряд из сохранённой копии','Series from cache','已缓存的统计序列'],
  ['Задать вопрос по региону','Ask about this region','询问此地区'],
  ['Последние три полных года','Last three complete years','最近三个完整年度'],
  ['Методика Росстата изменилась с января 2026 года.','Rosstat methodology changed in January 2026.','俄罗斯统计局自2026年1月起调整统计方法。'],
  ['Методология Росстата','Rosstat methodology','俄罗斯统计方法'],
  ['Месячные значения','Monthly values','月度数值'],
  ['{date} · {days} дня · {size} чел.','{date} · {days} days · {size} people','{date} · {days} 天 · {size} 人'],
  ['Владимир','Vladimir','弗拉基米尔'],
  ['Суздаль','Suzdal','苏兹达尔'],
  ['Кидекша','Kideksha','基杰克沙'],
  ['Муром','Murom','穆罗姆'],
  ['Гусь-Хрустальный','Gus-Khrustalny','古斯-赫鲁斯塔利内'],
  ['Боголюбово','Bogolyubovo','博戈柳博沃'],
  ['На эти даты варианты не найдены. Измените параметры программы или уточните данные объектов.',
    'No options found for these dates. Change the itinerary requirements or check place conditions.',
    '这些日期未找到方案。请修改行程参数或核实地点条件。'],
  ['Сравниваем проверенные варианты…','Comparing verified options…','正在比较已核查的方案…'],
  ['Готовность программы','Itinerary readiness','行程准备情况'],
  ['Что подтвердить для запуска','What to confirm before launch','启动前需要确认的事项'],
  ['Обязательные позиции помещаются в расписание.','Required stops fit the schedule.','所需停留点均可纳入日程。'],
  ['В расписании ещё есть незакрытые обязательные позиции.','Some required slots in the itinerary remain unfilled.','行程中仍有必需的环节尚未落实。'],
  ['Учебные условия показывают механику расчёта. Для поездки нужны сведения от поставщиков.','Training conditions illustrate the calculation. Ask suppliers for actual trip conditions.','演示条件仅用于说明计算方式。实际出行条件需向供应方确认。'],
  ['{city} · день {day} · {date}','{city} · day {day} · {date}','{city} · 第 {day} 天 · {date}'],
  ['Посещения','Visits','参观'],
  ['Питание','Meals','餐饮'],
  ['Ночёвка','Overnight stay','住宿一晚'],
  ['Подтверждённая точка посещения','Confirmed visit','已确认的参观地点'],
  ['Вторая точка посещения','Second visit','第二个参观地点'],
  ['Место для обеда','Lunch venue','午餐地点'],
  ['Требуется подтверждение: {items}.','Confirm: {items}.','待确认：{items}。'],
  ['Запросить у объектов время визита, запись и лимит для группы из {size} чел.','Ask venues for a visit time, booking requirements and a limit that fits {size} people.','请向场馆确认参观时段、预约要求及能否接待 {size} 人。'],
  ['Запросить у ресторана время обеда и рассадку для {size} чел.','Ask the restaurant for a lunch slot and seating for {size} people.','请向餐厅确认午餐时段及 {size} 人的座位。'],
  ['Запросить у гостиницы доступность номеров и условия заселения для {size} чел.','Ask the hotel for available rooms and check-in conditions for {size} people.','请向酒店确认 {size} 人所需客房及入住条件。'],
  ['Проверить условия в паспорте объекта','Check conditions in the place record','在地点档案中核查条件'],
  ['В каталоге на эту дату нет объекта без известного ограничения.','The catalogue lists no candidate without a known restriction on this date.','目录中当天暂无没有已知限制的候选地点。'],
  ['Транспорт','Transport','交通'],
  ['Сверить с перевозчиком время выезда, место посадки и наличие транспорта для группы.','Agree departure time, pickup point and group transport availability with the carrier.','请向交通服务方确认出发时间、上车地点及团队用车。'],
  ['Китайскоязычное сопровождение','Chinese-language support','中文陪同服务'],
  ['Подтвердить сопровождающего и согласовать работу с переводчиком у объектов.','Confirm the escort and arrange interpreter access with venues.','请确认中文陪同人员，并与场馆协调翻译事宜。'],
  ['Семейный формат','Family itinerary','亲子行程'],
  ['Уточнить возрастные ограничения, длительность визитов для детей и семейные услуги у объектов.','Ask venues about age restrictions, suitable visit lengths for children and family services.','请向场馆确认年龄限制、适合儿童的参观时长及亲子服务。'],
  ['Романтический формат','Romantic itinerary','浪漫行程'],
  ['Сверить с организатором темп программы. У заведений уточнить условия обслуживания пары.','Agree the pace with the organiser and check arrangements for couples with the venues.','请与组织方确认行程节奏，并向场馆核实双人服务安排。'],
  ['Условия пешей части','Walking conditions','徒步条件'],
  ['Сверить с организатором состояние тропы, доступность на дату и запасной вариант.','Check trail conditions, accessibility on the date and a backup with the organiser.','请与组织方确认步道状况、当天可通行性及备用方案。'],
  ['Ключевая остановка для формата','Key stop for this format','本行程类型的核心停留点'],
  ['Найти подходящий объект и подтвердить условия посещения на дату.','Find a suitable place and confirm the visit conditions for the date.','寻找合适地点，并确认当天的参观条件。'],
  ['Подтверждение брони','Booking confirmation','预订确认'],
  ['Подтвердить у поставщиков наличие мест и запись на выбранные даты.','Confirm availability and reservations for the selected dates with suppliers.','请向供应方确认所选日期的名额及预约。'],
  ['{kind} · два сеанса по {size} чел.','{kind} · two sessions of {size} people','{kind} · 两场，每场 {size} 人'],
  ['{kind} · лимит {size} чел.','{kind} · limit {size} people','{kind} · 上限 {size} 人'],
  ['{kind} · учебный лимит {size} чел.','{kind} · training limit {size} people','{kind} · 演示上限 {size} 人'],
  ['{city} · {day}','{city} · {day}','{city} · {day}'],
  ['Требуют внимания {count} из {total}','{count} of {total} need attention','{total} 项中有 {count} 项需关注'],
  ['Для выбранного формата требуется ключевая остановка с подходящими условиями на дату поездки.',
    'This format requires a key stop with suitable conditions on the travel date.','此行程类型需要一个在出行日期符合条件的核心停留点。'],
  ['В пилотном каталоге нет подтверждённых объектов для этого формата. Культурные остановки показаны для справки.',
    'The pilot catalogue has no confirmed places for this format. Cultural stops are shown for reference.','试点目录中暂无适合此行程类型的已确认地点。文化景点仅供参考。'],
  ['Приоритет у музеев. Возрастные условия и семейные услуги нужно уточнить у объектов.',
    'Museums take priority. Confirm age requirements and family services with venues.','优先安排博物馆。请向场馆确认年龄要求及亲子服务。'],
  ['Приоритет у архитектурных остановок и коротких визитов.',
    'Architectural stops and short visits take priority.','优先安排建筑景点和短时参观。'],
  ['Время переездов ориентировочное. Сверьте время в пути и точки посадки с перевозчиком, а групповые места с поставщиками.',
    'Transfer times are estimates. Check journey time and pickup points with the carrier and group availability with suppliers.','交通时间为估算值。请向交通服务方确认行车时间和上车地点，并向供应方确认团队名额。'],
  ['Переезды и запас между остановками рассчитаны по схеме пилота. Транспорт и брони подтверждаются отдельно.',
    'Transfers and buffers between stops follow the pilot plan. Confirm transport and reservations separately.','交通和各停留点间的预留时间按试点方案估算。交通与预约需单独确认。'],
  ['Перед пешей частью проверьте состояние тропы, световой день и доступность после паводка или снегопада.',
    'Before walking, check trail conditions, daylight and access after flooding or snowfall.','徒步前请核查步道状况、日照时间及洪水或降雪后的通行情况。'],
  ['Два сеанса и ожидание второй подгруппы нужно согласовать с объектом.',
    'Agree both sessions and a waiting arrangement for the second group with the venue.','请与场馆确认两场参观及第二小组的等候安排。'],
  ['Согласуйте два отдельных сеанса с музеем.','Arrange two separate sessions with the museum.','请与博物馆确认两个独立场次。'],
  ['Группа из {total} чел. проверена для двух сеансов до {size} чел. каждый. Согласуйте оба сеанса с музеем.',
    'The group of {total} was checked for two sessions of up to {size} people each. Confirm both sessions with the museum.',
    '已按两场、每场至多 {size} 人核查这个 {total} 人团队。请与博物馆确认两场参观。'],
]);
let data;
let geodata = {};
let atlas;
let composer;
let knowledge;
let cityOverview;
let atlasHash;
let pilotRouteHash;
const mapContexts = new Map();
const passportButtons = 'button[data-place], button[data-atlas="passport"]';
let passportReturn = null;
let options = {...defaultRoute,demo:false};
let activeRouteAnalysis = null;
let review = newReview();
const overview = {filter:'external',selected:null};
let agent;
let busy = false;
let metric = 'nights';
const statistics = {regionId:'83',period:'full',regions:null,lookup:null,result:null,loading:false,version:0};
let offerSearch = {date:defaultRoute.date,occupancy:2,result:null};
let filters = {search:'',kind:'all',status:'all',city:'all',date:'',size:null};
let toastTimer;
const safe = value => String(value ?? '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
const chip = (text,type='') => '<span class="chip '+type+'">'+safe(text)+'</span>';
const outbound = (href,label) => '<a href="'+safe(href)+'" target="_blank" rel="noopener noreferrer">'+safe(label)+'</a>';
const path = () => location.hash.slice(1).split('?')[0];
const page = () => Object.hasOwn(labels,path()) ? path() : 'overview';
const params = () => new URLSearchParams(location.hash.slice(1).split('?')[1]);
const date = text => formatDate(text,{day:'numeric',month:'short',year:'numeric'});
const timestamp = text => text ? formatDate(text,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : t('ещё не проверен');
const sameSettings = (a,b) => [...Object.keys(defaultRoute),'direction'].every(key=>a[key]===b[key]);
const head = (title,subtitle='',action='') => '<header class="page-head"><div><h1>'+safe(title)+'</h1>'+
  (subtitle ? '<p class="muted">'+safe(subtitle)+'</p>' : '')+'</div>'+action+'</header>';
const button = (label,action,quiet=false) => '<button type="button" class="'+(quiet?'button-quiet':'button')+'" data-action="'+action+'">'+safe(label)+'</button>';
const val = v => v===null ? 'нет данных' : typeof v==='number' ? number(v) : Array.isArray(v) ? v.join(', ') : String(v);
const placeDay = place => place.city==='Суздаль' ? 1 : place.city==='Кидекша' ? 2 : 0;
const catalogSettings = () => ({...options,date:filters.date || options.date,size:filters.size ?? options.size,demo:false});
const itemName = item => getLocale()==='zh' ? item.cn || item.name : getLocale()==='en' ? item.en || item.name : item.name;

function visitDay(start, day) {
  const value = new Date(start+'T12:00:00Z');
  value.setUTCDate(value.getUTCDate()+day);
  return value.toISOString().slice(0,10);
}
const visitDate = (start,day)=>date(visitDay(start,day));

function openingLabel(official) {
  if (!official) return 'График не найден';
  if (!official.windows) return 'График не покрывает дату';
  if (!official.windows.length) return 'Закрыто по графику';
  return official.windows.map(([open,close])=>clockTime(open)+'–'+clockTime(close)).join(', ');
}

async function api(path,body,method=body===undefined ? 'GET' : 'POST',{signal}={}) {
  const res = await fetch('/api/'+path,{method,signal,headers:body===undefined ? {} : {'Content-Type':'application/json'},body:body===undefined ? undefined : JSON.stringify(body)});
  const result = await res.json();
  if (!res.ok) throw Object.assign(new Error(result.error || 'Действие не выполнено'), { status:res.status });
  return result;
}

function newReview(preview = null, program = null) {
  cancelRouteAnalysis();
  return { preview, program, variants:null, selectedId:null, loading:false, error:'', brief:'', analysis:null,
    dirty:false, approval:null };
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(()=>{ $('#toast').hidden=true; },5500);
}

function statisticsMonth(month, width = 'long') {
  const index = months.indexOf(month);
  return index < 0 ? month : formatDate(new Date(Date.UTC(2024,index,1)),{month:width});
}

function statisticChart(series) {
  const maximum = Math.max(1,...series.averages.map(month=>month.value ?? 0));
  const lows = new Set(series.lows.map(month=>month.month));
  const columns = series.averages.map(({month,value})=>{
    const height = value===null ? 0 : Math.round(100*value/maximum);
    const tooltip = statisticsMonth(month)+' · '+(value===null ? t('нет данных') : formatNumber(value)+' '+t(series.unit));
    return '<div class="chart-col" title="'+safe(tooltip)+'"><div class="chart-value">'+
      (value===null?'—':safe(formatNumber(value,{notation:'compact',maximumFractionDigits:0})))+'</div><div class="bar-base"><div class="chart-bar '+
      (lows.has(month)?'low':'')+'" style="--h:'+height+';width:100%;'+(value===null?'visibility:hidden':'')+'"></div></div><span>'+safe(statisticsMonth(month,'short'))+'</span></div>';
  }).join('');
  const full = series.years.filter(year=>year.total!==null);
  const years = (full.length ? full : series.years).map(year=>year.year).join(', ');
  const chartCaption = series.years.length===1 ? t('Месячные значения за {year}.',{year:years}) :
    t('Среднее по месяцам за {years}. Тёмным выделены три месяца с наименьшими значениями.',{years});
  const graph = series.mixedMethodology ? '' : '<div class="chart" aria-hidden="true">'+columns+'</div><p class="caption">'+safe(chartCaption)+'</p>';
  const methodology = series.methodologyChange ? '<p class="caption">'+safe(t('Начиная с января 2026 года действует обновлённая методика Росстата.'))+' '+
    (series.mixedMethodology ? safe(t('Среднее и темп изменения между периодами с разной методикой не рассчитаны.'))+' ' : '')+
    outbound(series.methodologyChange.source,t('Методология Росстата'))+'</p>' : '';
  return graph+methodology+
    '<details'+(series.mixedMethodology?' open':'')+'><summary class="link-button">'+safe(t('Значения по месяцам'))+'</summary><div class="table-wrap"><table><thead><tr><th>'+safe(t('Месяц'))+'</th>'+
    series.years.map(year=>'<th scope="col">'+safe(year.year)+'</th>').join('')+'</tr></thead><tbody>'+months.map((month,index)=>
      '<tr><th scope="row">'+safe(statisticsMonth(month))+'</th>'+series.years.map(year=>
        '<td>'+safe(year.monthly[index]==null ? t('нет данных') : formatNumber(year.monthly[index]))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details>';
}

function matchingPlaces(settings) {
  const query = filters.search.toLowerCase().trim();
  return data.places.filter(place=>{
    const result = assess(place,settings,0);
    return (filters.kind==='all'||place.kind===filters.kind) && (filters.status==='all'||result.status===filters.status) &&
      (filters.city==='all'||filters.city===place.city) && (!query ||
        [place.name,place.cn,place.en,place.city,t(place.city)].some(value=>value?.toLowerCase().includes(query)));
  });
}

function selectOption(value,label,selected) {
  return '<option value="'+safe(value)+'"'+(value===selected?' selected':'')+'>'+safe(label)+'</option>';
}

function catalogRows() {
  const settings = catalogSettings();
  const matching = matchingPlaces(settings);
  if (!matching.length) return '<tr role="row"><td role="cell" colspan="6"><p class="empty">Подходящих объектов нет.</p></td></tr>';
  return matching.map(place=>{
    const offset = 0;
    const result = assess(place,settings,offset);
    const evidence = place.publishedConditions;
    const hours = publishedHours(place,settings.date,offset);
    const source = evidence?.schedule?.url ?? evidence?.booking?.url ?? evidence?.notes?.[0]?.url;
    return '<tr role="row"><td role="cell"><button class="link-button" data-source-text data-place="'+safe(place.id)+'" data-place-day="0">'+safe(itemName(place))+
      '</button></td><td role="cell">'+safe(t(place.city))+'</td>'+
      '<td role="cell">'+safe(t(openingLabel(hours)))+(hours?.label ? '<div class="caption" data-source-text>'+safe(hours.label)+'</div>' : '')+'</td>'+
      '<td role="cell">'+safe(t(kindNames[place.kind]))+'</td><td role="cell">'+chip(t(statusText[result.status]),result.status==='blocked'?'error':result.status==='unknown'?'warn':'')+'</td>'+
      '<td role="cell">'+outbound(source ?? place.url,t(source ? 'Условия визита' : place.url.includes('wikidata')?'Wikidata':'Страница объекта'))+'</td></tr>';
  }).join('');
}

function catalog() {
  const settings = catalogSettings();
  const cities = [...new Set(data.places.map(place=>place.city))];
  return head(t('Каталог объектов'),t('Данные Владимирской области'))+
    '<section class="panel"><div class="filters"><label class="field">Дата визита<input id="catalog-date" type="date" min="2000-01-01" max="2099-12-31" required aria-describedby="catalog-conditions-status" value="'+safe(settings.date)+'"></label>'+
    '<label class="field compact-field">Размер группы<input id="catalog-size" type="number" min="1" max="100" required aria-describedby="catalog-conditions-status" value="'+settings.size+'"></label>'+
    '<label class="field flex-grow">Поиск<input type="search" id="search" placeholder="Название или город" value="'+safe(filters.search)+
    '"></label><label class="field">Город<select id="city">'+selectOption('all',t('Все города'),filters.city)+cities.map(city=>selectOption(city,t(city),filters.city)).join('')+
    '</select></label><label class="field">Категория<select id="kind">'+Object.entries({all:'Все категории',...kindNames}).map(([v,label])=>selectOption(v,t(label),filters.kind)).join('')+
    '</select></label><label class="field">Готовность<select id="status">'+Object.entries({all:'Любой статус',...statusText}).map(([v,label])=>selectOption(v,t(label),filters.status)).join('')+
    '</select></label></div><p id="catalog-conditions-status" class="caption" role="status"></p>'+
    '<div class="table-wrap catalog-table"><table role="table"><thead role="rowgroup"><tr role="row"><th scope="col">Объект</th><th scope="col">Город</th><th scope="col">Опубликованный график</th><th scope="col">Категория</th><th scope="col">Готовность</th><th scope="col">Источник</th></tr></thead>'+
    '<tbody id="catalog-rows" role="rowgroup">'+catalogRows()+'</tbody></table></div></section>';
}

function evidenceReason(reason) {
  const groupLimit = reason.match(/^Лимит (\d+) чел\. для группы из (\d+)\.$/);
  if (groupLimit) return t('Лимит {limit} чел. для группы из {group}.',{limit:groupLimit[1],group:groupLimit[2]});
  const publishedLimit = reason.match(/^Опубликованный лимит для этого посещения — (\d+) чел\.$/);
  if (publishedLimit) return t('Опубликованный лимит для этого посещения — {limit} чел.',{limit:publishedLimit[1]});
  return t(reason);
}

function bookingCutoffMarkup(deadline) {
  const today = new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'});
  const label = deadline.date<today ? 'Срок новой заявки на комплексную экскурсию истёк {date}. Если заявка уже подана, проверьте её статус.' :
    'Заявка на комплексную экскурсию подаётся до {date} (за {days} дней).';
  return '<p class="detail">'+safe(t(label,{date:date(deadline.date).replace(/ г\.$/u,''),days:formatNumber(deadline.days)}))+' '+
    outbound(deadline.url,t('Оферта музея'))+'</p>';
}

function officialEvidence(place,settings,offset) {
  const evidence = place.publishedConditions;
  const officialDate = visitDate(settings.date,offset);
  const result = assess(place,{...settings,demo:false},offset);
  const status = chip(t(statusText[result.status]),result.status==='blocked'?'error':result.status==='unknown'?'warn':'');
  const summary = '<div class="official-evidence-head"><div><h3>'+safe(t('Опубликованные условия'))+'</h3><p class="caption">'+
    safe(t('{date} · группа {size} чел.',{date:officialDate,size:formatNumber(settings.size)}))+'</p></div>'+status+'</div>';
  if (!evidence) return '<section class="official-evidence">'+summary+
    '<p class="detail">'+safe(t('В собранных источниках нет условий визита. Уточните часы, запись и допустимый размер группы у объекта.'))+'</p></section>';
  const hours = publishedHours(place,settings.date,offset);
  const deadline = groupApplicationDeadline(place,visitDay(settings.date,offset));
  const sourceText = text=>'<p lang="ru" data-source-text>'+safe(text)+'</p>';
  const lastEntry = hours?.windows?.length && hours.lastEntryMinutes ?
    '<p class="caption">'+safe(t('Последний вход {time}',{time:hours.windows.map(([,close])=>clockTime(close-hours.lastEntryMinutes)).join(', ')}))+'</p>' : '';
  const validity = [hours?.validFrom && t('с {date}',{date:date(hours.validFrom)}),
    hours?.validUntil && t('по {date}',{date:date(hours.validUntil)})].filter(Boolean).join(' ');
  const period = validity ? '<p class="caption">'+safe(t('Период действия {period}',{period:validity}))+'</p>' : '';
  const facts = items=>items.map(item=>'<li>'+sourceText(item.text)+outbound(item.url,t('Источник'))+'</li>').join('');
  const sourceQuestions = new Set(evidence.clarify ?? []);
  const questions = [...new Set([...sourceQuestions,...(result.status==='unknown' ? result.reasons : [])])];
  return '<section class="official-evidence">'+summary+
    (result.status==='blocked' ? '<p class="detail">'+safe(result.reasons.map(evidenceReason).join(' '))+'</p>' : '')+
    (questions.length ? '<div class="callout"><strong>'+safe(t('Уточнить у объекта'))+'</strong><ul class="official-questions">'+
      questions.map(question=>sourceQuestions.has(question) ? '<li lang="ru" data-source-text>'+safe(question)+'</li>' : '<li>'+safe(evidenceReason(question))+'</li>').join('')+'</ul></div>' : '')+
    '<dl class="official-facts"><dt>'+safe(t('График'))+(hours?.label?' · <span lang="ru" data-source-text>'+safe(hours.label)+'</span>':'')+
    '</dt><dd><strong>'+safe(t(openingLabel(hours)))+'</strong>'+
    (hours ? lastEntry+period+(hours.note?'<p class="detail" lang="ru" data-source-text>'+safe(hours.note)+'</p>':'')+
      outbound(hours.url,t('Опубликованный график')) : '')+'</dd>'+
    (evidence.booking ? '<dt>'+safe(t('Правила записи'))+'</dt><dd>'+sourceText(evidence.booking.text)+outbound(evidence.booking.url,t('Источник'))+
      (deadline?bookingCutoffMarkup(deadline):'')+'</dd>' : '')+
    (evidence.limits?.length ? '<dt>'+safe(t('Лимиты отдельных посещений'))+'</dt><dd><ul class="official-links">'+facts(evidence.limits)+'</ul></dd>' : '')+
    (evidence.notes?.length ? '<dt>'+safe(t('Другие сведения'))+'</dt><dd><ul class="official-links">'+facts(evidence.notes)+'</ul></dd>' : '')+
    '</dl><p class="caption">'+safe(t('Сверено с опубликованными источниками {date}. Наличие мест на дату визита проверяется отдельно.',
      {date:date(evidence.checkedAt)}))+'</p></section>';
}

function passportFocus(button) {
  if (!button?.matches(passportButtons)) return null;
  const scope = button.closest('[aria-labelledby], #catalog-rows, #atlas-inspector, .route-journal');
  const label = scope?.getAttribute('aria-labelledby');
  const selector = scope?.id ? '#'+CSS.escape(scope.id) : label ? '[aria-labelledby="'+CSS.escape(label)+'"]' :
    scope?.classList.contains('route-journal') ? '.route-journal' : '#screen';
  return {button,selector,hash:location.hash};
}

function restorePassportFocus(entry) {
  if (!entry || entry.hash!==location.hash || dialog.open) return;
  const {button,selector} = entry;
  const fields = ['place','placeDay','decision','atlas','value'];
  const match = button.isConnected ? button : [...($(selector)?.querySelectorAll(passportButtons) ?? [])]
    .find(candidate=>fields.every(field=>candidate.dataset[field]===button.dataset[field]));
  if (match) {
    const disclosure = match.closest('details');
    if (disclosure) disclosure.open=true;
    match.focus({preventScroll:true});
  } else {
    ($('#route-program-title') ?? $('#content')).focus({preventScroll:true});
  }
}

function placeDetails(id,decisionId,requestedDay,requestedSettings,requestedStop,trigger) {
  const place = data.places.find(x=>x.id===id);
  if (!place) return;
  const decision = data.decisions?.find(item=>item.id===decisionId);
  const settings = decision?.settings ?? requestedSettings ?? (page()==='catalog' ? catalogSettings() : options);
  const audit = settings.demo ? place.audit : place.verifiedAudit;
  const plan = decision?.plan ?? (page()==='route' ? selectedVariant()?.plan ?? review.preview : null);
  const day = plan?.days.findIndex(segment=>segment.stops.some(stop=>stop.id===id));
  const offset = Number.isInteger(requestedDay) ? requestedDay : day>=0 ? day : placeDay(place);
  const stop = requestedStop ?? plan?.days[offset]?.stops.find(item=>item.id===id);
  const requirements = stop?.split ? {...settings,size:Math.ceil(settings.size/2)} : settings;
  const result = assess(place,requirements,offset);
  const field = (label,content)=>'<dt>'+safe(t(label))+'</dt><dd>'+content+'</dd>';
  const title = itemName(place);
  const titleLang = title===place.name ? 'ru' : localeTag();
  dialog.innerHTML = '<div class="section-head"><h2 id="place-title" lang="'+safe(titleLang)+'" data-source-text>'+safe(title)+'</h2>'+
    button(t('Закрыть'),'close',true)+'</div>'+
    (title!==place.name ? '<p class="lang-line" lang="ru" data-source-text>'+safe(place.name)+'</p>' : '')+
    '<p class="caption">'+safe(t(place.city))+' · '+safe(t(kindNames[place.kind]))+'</p>'+officialEvidence(place,settings,offset)+'<dl class="dialog-fields">'+
    field('Источник сведений об объекте',outbound(place.url,place.url.includes('wikidata')?'Wikidata':t('Страница объекта')))+
    field('Дата проверки',safe(date(place.checkedAt)))+
    (place.coordinates ? field('Координаты',outbound(place.wikiLink,place.coordinates.map(x=>x.toFixed(5)).join(', '))+
      '<div class="caption">Wikidata · '+safe(timestamp(place.wikiCheckedAt))+'</div>') : '')+
    (audit ? field(settings.demo?'Учебный режим':'Экспертное подтверждение',settings.demo
      ? outbound('/api/audit-version/'+data.auditVersion,t('Учебный аудит, версия {version}',{version:data.auditVersion}))+
        ' · '+chip(t(statusText[result.status]),result.status==='ready'?'':'warn')
      : outbound(audit.sourceUrl,t('Источник подтверждённых условий')))+
      (audit.verifiedAt ? field('Проверено',safe(date(audit.verifiedAt))) : '')+
      (audit.validUntil ? field('Действует до',safe(date(audit.validUntil))) : '')+
      (audit.booking ? field('Запись',safe(t(audit.booking==='reservation'?'Нужно бронирование':'Предварительная запись не требуется'))) : '')+
      field('Лимит группы',safe(t('{count} чел.',{count:formatNumber(audit.capacity)})))+
      field('Часы работы',safe(audit.hours.map(hour=>clockTime(hour*60)).join('–')))+
      field('Продолжительность',safe(t('{minutes} мин.',{minutes:formatNumber(audit.minutes)})))+
      field('Под перевод',safe(t(audit.language==='interpreter'
        ? settings.demo?'Предусмотрено в демо':'Подтверждено источником' : 'Требует подтверждения'))) : '')+
    '</dl>'+(settings.demo && audit ? result.reasons.map(reason=>'<p class="detail">'+safe(evidenceReason(reason))+'</p>').join('') : '');
  if (stop?.split) dialog.insertAdjacentHTML('beforeend','<p class="callout">'+safe(t(
    'Группа из {total} чел. проверена для двух сеансов до {size} чел. каждый. Согласуйте оба сеанса с музеем.',
    {total:formatNumber(settings.size),size:formatNumber(requirements.size)}))+'</p>');
  passportReturn=passportFocus(trigger ?? document.activeElement);
  dialog.showModal();
}

function routeCity(day) {
  return itemName({...day,name:t(day.city)});
}

function routeStopName(stop) {
  if (stop.type!=='travel') return itemName(stop);
  const label = itemName(stop);
  return label===stop.name ? label.split(' → ').map(city=>t(city)).join(' → ') : label;
}

function renderDay(day,index,settings,decisionId) {
  const reference = decisionId ? ' data-decision="'+safe(decisionId)+'"' : '';
  return '<section class="route-day"><div class="route-day-head"><p class="caption">'+safe(t('День {day}',{day:formatNumber(index+1)}))+' · '+date(day.date)+'</p><h3>'+safe(routeCity(day))+'</h3></div>'+
    (decisionId?'':weatherSlot(index))+
    '<ul class="rows">'+day.stops.map(stop=>{
      const template = stop.split ? '{kind} · два сеанса по {size} чел.' : settings.demo ? '{kind} · учебный лимит {size} чел.' : '{kind} · лимит {size} чел.';
      const status = stop.type==='travel' ? t('Переезд · расчётное время') : stop.provisional ?
        t('{kind} · время предложено по опубликованному графику',{kind:t(kindNames[stop.type])}) : t(template,{
        kind:t(kindNames[stop.type]),size:formatNumber(stop.split?Math.ceil(settings.size/2):stop.capacity)});
      return '<li class="timeline"><time>'+safe(stop.start)+'–'+safe(stop.end)+'</time><div class="label-pair">'+
      (stop.id ? '<button type="button" class="link-button" data-source-text data-place="'+safe(stop.id)+'" data-place-day="'+index+'"'+reference+'>'+safe(routeStopName(stop))+'</button>' :
        '<strong data-source-text>'+safe(routeStopName(stop))+'</strong>')+
      (getLocale()!=='zh' && settings.market==='zh' && stop.cn ? '<span lang="zh-Hans" class="lang-line">'+safe(stop.cn)+'</span>':'')+
      '<span class="caption">'+safe(status)+'</span></div></li>';
    }).join('')+
    '</ul>'+(day.missing.length?'<p class="callout">'+safe(t('Требуется подтверждение: {items}.',{
      items:day.missing.map(item=>t(item)).join(getLocale()==='zh'?'、':', ')}))+'</p>':'')+'</section>';
}

function scheduleKey(plan) {
  return JSON.stringify(plan.days.map(day=>day.stops.map(stop=>[stop.id,stop.start,stop.end,Boolean(stop.split)])));
}

function selectedVariant() {
  return review.variants?.find(variant=>variant.id===review.selectedId);
}

function routeState(plan) {
  if (!plan.completeness) return chip('Есть пробелы','warn');
  if (plan.days.some(day=>day.stops.some(stop=>stop.split))) return chip('Согласуйте два сеанса','warn');
  return chip(plan.settings.demo ? 'Проходит учебную проверку' : 'Проходит проверку');
}

function variantHighlight(plan,baseline) {
  const visits = plan.days.flatMap(day=>day.stops.filter(stop=>stop.type==='visit'));
  const split = visits.find(stop=>stop.split);
  if (split) return split.name+' · два сеанса';
  if (plan!==baseline) {
    const replacements = plan.days.flatMap((day,index)=>{
      const original = baseline.days[index]?.stops ?? [];
      return day.stops.filter(stop=>stop.id && !original.some(previous=>previous.id===stop.id));
    });
    if (replacements.length) return replacements.map(stop=>stop.name).join(' · ');
    const orderChanged = plan.days.find((day,index)=>
      day.stops.map(stop=>stop.id).join(',')!==baseline.days[index]?.stops.map(stop=>stop.id).join(','));
    if (orderChanged) return orderChanged.stops.filter(stop=>stop.type==='visit').map(stop=>stop.start+' '+stop.name).join(' · ');
  }
  return visits.slice(-2).map(stop=>stop.name).join(' · ') || 'Точки требуют уточнения';
}

function routeVariants() {
  const heading = '<div class="section-head"><h2>Варианты программы</h2></div>';
  if (review.loading) return '<section class="panel">'+heading+'<p class="detail" role="status">Проверяем расписание и условия объектов…</p></section>';
  if (review.error) return '<section class="panel">'+heading+'<p class="callout" role="alert">'+safe(review.error)+'</p>'+
    '<div class="actions spaced">'+button('Повторить расчёт','retry-variants',true)+'</div></section>';
  if (!review.variants?.length) return '<section class="panel">'+heading+'<p class="detail">На эти даты варианты не найдены. Измените параметры программы или уточните данные объектов.</p></section>';
  const issues = data.affected.find(record=>record.id===review.program?.id)?.issues;
  const issue = issues?.[0];
  return '<section class="panel" aria-labelledby="route-variants-title"><div class="section-head"><h2 id="route-variants-title">Варианты программы</h2></div>'+
    (issue ? '<p class="detail route-change"><strong>'+safe(issue.name)+'</strong> · '+safe(issue.reasons.join(' '))+'</p>' : '')+
    '<div class="route-variant-list">'+review.variants.map(variant=>
      '<button type="button" class="route-variant" data-action="select-variant" data-variant="'+safe(variant.id)+'" aria-pressed="'+(variant.id===review.selectedId)+'">'+
      '<strong>'+safe(variant.title)+'</strong><span>'+safe(variantHighlight(variant.plan,review.variants[0].plan))+'</span></button>').join('')+'</div></section>';
}

function routeAssistant() {
  const analysis = review.analysis;
  const request = activeRouteAnalysis?.review===review ? activeRouteAnalysis : null;
  const suggestions = analysis?.status==='live' ? analysis.suggestions.flatMap(suggestion=>{
    const variant = review.variants?.find(item=>item.id===suggestion.id);
    return variant ? ['<li><button type="button" class="link-button" data-action="select-variant" data-variant="'+safe(variant.id)+'" aria-pressed="'+
      (variant.id===review.selectedId)+'">'+safe(variant.title)+'</button><p class="detail">'+safe(suggestion.explanation)+'</p></li>'] : [];
  }).join('') : '';
  const eligible = review.variants?.filter(item=>item.plan.completeness).length >= 2;
  return '<section class="panel route-assistant" aria-labelledby="route-ai-title"><h2 id="route-ai-title">Сравнение с ИИ</h2>'+
    '<p class="detail">ИИ оценивает, какой вариант лучше сохраняет замысел программы. Расписание и лимиты проверяет сервис.</p>'+
    (eligible ? '<form id="route-ai-form"><label class="field">Что важно сохранить <span class="caption">Необязательно</span>'+
      '<textarea name="brief" maxlength="400" rows="3" placeholder="Например, сохранить знакомство с архитектурой Суздаля"'+
      (request?' readonly':'')+'>'+safe(review.brief)+'</textarea></label>'+
      '<button type="submit" class="button-quiet"'+(analysis?' aria-describedby="route-ai-message"':'')+
      (request||review.dirty?' disabled':'')+'>'+
      (['unavailable','cancelled'].includes(analysis?.status)?'Повторить запрос':'Сравнить варианты с ИИ')+'</button></form>' :
      '<p class="caption route-ai-empty">Для сравнения нужны два варианта, прошедших проверку.</p>')+
    (request ? aiWaitingMarkup('Сравниваем проверенные варианты…',request.startedAt,'cancel-route-ai') : '')+
    (analysis ? '<div class="route-ai-result"><p id="route-ai-message" role="status" class="'+(analysis.status==='unavailable'?'callout':'caption')+'">'+safe(analysis.message)+'</p>'+
      (suggestions?'<ol class="route-ai-suggestions">'+suggestions+'</ol>':'')+'</div>' : '')+'</section>';
}

function approvedVariant(variant) {
  if (!variant) return false;
  if (review.approval?.variantId===variant.id && review.approval.planSignature===variant.signature) return true;
  return data.decisions?.some(decision=>{
    const tracked = data.affected.find(record=>record.id===decision.programId);
    return decision.variantId===variant.id && (decision.planSignature??decision.signature)===variant.signature &&
      tracked && scheduleKey(tracked.baseline)===scheduleKey(variant.plan);
  });
}

function routeDecision(plan,timetable) {
  const variant = selectedVariant();
  const approved = approvedVariant(variant);
  const approvalVisible = !review.loading && variant?.signature && variant.plan.completeness;
  const localized = plan.settings.market==='zh';
  const assumptions = plan.assumptions?.length ? plan.assumptions : plan.days.some(day=>day.stops.some(stop=>stop.split))
    ? ['Согласуйте два отдельных сеанса с музеем.'] : [];
  return '<section class="panel route-program" aria-labelledby="route-program-title"><div class="section-head"><div>'+
    '<h2 id="route-program-title" tabindex="-1">'+safe(plan.days.map(day=>t(day.city)).join(' → '))+'</h2>'+
    '<p class="caption">'+safe(t('{date} · {days} дня · {size} чел.',{date:date(plan.settings.date),days:formatNumber(plan.settings.days),size:formatNumber(plan.settings.size)}))+
    (localized?' · '+safe(t('Группа из Китая')):'')+'</p></div>'+routeState(plan)+'</div>'+
    (timetable.publishedPreview ? '<div class="callout"><strong>'+safe(t('Предварительная программа по опубликованным часам'))+'</strong>'+
      '<p>'+safe(t('Время остановок ориентировочное. Для группы подтвердите свободный сеанс, запись и вместимость у поставщиков.'))+'</p></div>' : '')+
    chinesePreview(timetable)+
    (plan.themeNote ? '<p class="callout">'+safe(t(plan.themeNote))+'</p>' : '')+
    '<div class="route-days">'+timetable.days.map((day,i)=>renderDay(day,i,plan.settings)).join('')+'</div>'+
    (assumptions.length ? '<div class="callout">'+assumptions.map(note=>'<p>'+safe(t(note))+'</p>').join('')+'</div>' : '')+
    (approvalVisible ? '<div class="route-approval"><div><h3>'+(approved?'Решение сохранено':'Решение специалиста')+'</h3><p class="caption">'+
      (plan.settings.demo?'Согласование в рамках пилота. Подтверждение визитов остаётся за поставщиками.':
        'Согласование записывает эту версию программы в журнал. Подтвердите бронирование у поставщиков.')+
      '</p></div>'+(approved ? chip('Согласовано') :
        '<button type="button" class="button" data-action="approve-route"'+(review.dirty?' disabled':'')+'>Согласовать вариант</button>')+'</div>' : '')+'</section>';
}

function routeEvidence(plan) {
  const {settings} = plan;
  return plan.days.map((day,index)=>{
    const mealCity = day.mealCity ?? (day.city==='Кидекша'?'Суздаль':day.city);
    const stayCity = day.stayCity ?? day.city;
    const candidates = data.places.filter(place=>
      place.kind==='visit' && place.city===day.city && (!day.visitIds || day.visitIds.includes(place.id)) ||
      place.kind==='food' && place.city===mealCity || place.kind==='stay' && index<settings.days-1 && place.city===stayCity
    ).map(place=>({place,result:assess(place,settings,index),hours:publishedHours(place,settings.date,index)}));
    return {day,index,mealCity,stayCity,candidates};
  });
}

const launchChecks = [
  {kind:'visit',title:'Посещения',slots:['Подтверждённая точка посещения','Вторая точка посещения'],
    action:'Запросить у объектов время визита, запись и лимит для группы из {size} чел.'},
  {kind:'food',title:'Питание',slots:['Место для обеда'],
    action:'Запросить у ресторана время обеда и рассадку для {size} чел.'},
  {kind:'stay',title:'Ночёвка',slots:['Ночёвка'],
    action:'Запросить у гостиницы доступность номеров и условия заселения для {size} чел.'},
];

function pilotReadiness(plan,evidence,timetable) {
  const {settings} = plan;
  const size = formatNumber(settings.size);
  const checks = evidence.flatMap(({day,index,mealCity,stayCity,candidates})=>
    launchChecks.filter(check=>check.slots.some(slot=>day.missing.includes(slot))).map(check=>{
      const selected = new Set(day.stops.filter(stop=>stop.type===check.kind).map(stop=>stop.id));
      const contacts = candidates.filter(({place,result})=>place.kind===check.kind && result.status!=='blocked' && !selected.has(place.id))
        .toSorted((a,b)=>Number(Boolean(b.hours?.windows?.length || b.place.publishedConditions))-
          Number(Boolean(a.hours?.windows?.length || a.place.publishedConditions))).slice(0,2);
      const city = check.kind==='food' ? mealCity : check.kind==='stay' ? stayCity : day.city;
      return {title:check.title,action:t(check.action,{size}),index,contacts,
        context:t('{city} · день {day} · {date}',{city:t(city),day:formatNumber(index+1),date:date(day.date)})};
    })
  );
  if (!plan.completeness && !checks.length) checks.push({title:'Ключевая остановка для формата',
    action:t('Найти подходящий объект и подтвердить условия посещения на дату.')});
  if (settings.theme==='family') checks.push({title:'Семейный формат',
    action:t('Уточнить возрастные ограничения, длительность визитов для детей и семейные услуги у объектов.')});
  if (settings.theme==='romantic') checks.push({title:'Романтический формат',
    action:t('Сверить с организатором темп программы. У заведений уточнить условия обслуживания пары.')});
  if (['hike','nature'].includes(settings.theme)) checks.push({title:'Условия пешей части',
    action:t('Сверить с организатором состояние тропы, доступность на дату и запасной вариант.')});
  if (settings.market==='zh') checks.push({title:'Китайскоязычное сопровождение',
    action:t('Подтвердить сопровождающего и согласовать работу с переводчиком у объектов.')});
  if (plan.days.some(day=>day.stops.some(stop=>stop.type==='travel'))) checks.push({title:'Транспорт',
    action:t('Сверить с перевозчиком время выезда, место посадки и наличие транспорта для группы.')});
  if (plan.completeness) checks.push({title:'Подтверждение брони',
    action:t('Подтвердить у поставщиков наличие мест и запись на выбранные даты.')});
  const summary = settings.demo
    ? 'Учебные условия показывают механику расчёта. Для поездки нужны сведения от поставщиков.'
    : plan.completeness ? 'Обязательные позиции помещаются в расписание.' : 'В расписании ещё есть незакрытые обязательные позиции.';
  const deadlines = settings.demo ? [] : timetable.days.flatMap((day,index)=>{
    const visits = new Set(day.stops.filter(stop=>stop.provisional).map(stop=>stop.id));
    const results = evidence[index].candidates.filter(({place})=>visits.has(place.id)).map(({place})=>groupApplicationDeadline(place,day.date)).filter(Boolean);
    return [...new Map(results.map(deadline=>[deadline.date+deadline.url,deadline])).values()];
  });
  return '<section class="panel pilot-readiness" aria-labelledby="pilot-readiness-title"><div class="section-head"><div>'+
    '<h2 id="pilot-readiness-title" tabindex="-1">'+safe(t('Готовность программы'))+'</h2><p class="caption">'+safe(t(summary))+'</p></div>'+
    routeState(plan)+'</div>'+(deadlines.length ? '<div class="callout"><h3>'+safe(t('Срок подачи новой заявки'))+'</h3>'+
      deadlines.map(bookingCutoffMarkup).join('')+'</div>' : '')+'<h3>'+safe(t('Что подтвердить для запуска'))+'</h3><ul class="pilot-checks">'+
    checks.map(check=>'<li><div><strong>'+safe(t(check.title))+'</strong>'+
      (check.context ? '<p class="caption">'+safe(check.context)+'</p>' : '')+'</div><div><p class="detail">'+safe(check.action)+'</p>'+
      (check.contacts ? check.contacts.length ? '<div class="pilot-check-sources">'+check.contacts.map(({place})=>
        '<button type="button" class="link-button" title="'+safe(t('Проверить условия в паспорте объекта'))+
          '" data-place="'+safe(place.id)+'" data-place-day="'+check.index+'" data-source-text>'+safe(itemName(place))+'</button>').join('')+'</div>'
        : '<p class="caption">'+safe(t('В каталоге на эту дату нет объекта без известного ограничения.'))+'</p>' : '')+
      '</div></li>').join('')+'</ul></section>';
}

function officialRouteReview(evidence) {
  const itinerary = evidence.map(({day,index,candidates})=>{
    const unresolved = candidates.filter(item=>item.result.status!=='ready').length;
    const rows = candidates.map(({place,result,hours})=>
      '<li><div><button type="button" class="link-button" data-source-text data-place="'+safe(place.id)+'" data-place-day="'+index+'">'+safe(itemName(place))+'</button>'+
      '<p class="caption">'+safe(t(kindNames[place.kind]))+' · '+safe(t(openingLabel(hours)))+'</p>'+
      (result.reasons.length ? '<p class="detail"'+(place.publishedConditions?.clarify?.includes(result.reasons[0])?' lang="ru" data-source-text':'')+
        '>'+safe(evidenceReason(result.reasons[0]))+'</p>' : '')+'</div>'+
      chip(t(statusText[result.status]),result.status==='blocked'?'error':result.status==='unknown'?'warn':'')+'</li>').join('');
    const summary = t('{city} · {day}',{city:routeCity(day),day:t('День {day}',{day:formatNumber(index+1)})});
    return '<details><summary><span>'+safe(summary)+'<small>'+date(day.date)+'</small></span>'+
      '<span class="caption">'+safe(t('Требуют внимания {count} из {total}',{count:formatNumber(unresolved),total:formatNumber(candidates.length)}))+'</span></summary>'+
      (rows ? '<ul class="rows official-route-rows">'+rows+'</ul>' : '<p class="detail">'+
        safe(t('В каталоге пока нет объектов для этого дня.'))+'</p>')+'</details>';
  });
  return '<section class="panel official-route" aria-labelledby="official-route-title"><div class="section-head"><h2 id="official-route-title">Проверка условий на даты поездки</h2></div>'+
    '<p class="detail">Откройте объект, чтобы сверить опубликованный график, правила записи и вопросы для поставщика.</p>'+itinerary.join('')+'</section>';
}

function chinesePreview(plan) {
  const itinerary = chineseItinerary(plan);
  if (!itinerary) return '';
  const days = itinerary.days.map(day=>'<section class="chinese-day"><h4>'+safe(day.title)+'</h4><p class="caption">'+safe(day.date)+'</p>'+
    (day.stops.length ? '<ul class="rows">'+day.stops.map(stop=>'<li><time>'+safe(stop.time)+'</time><div><strong>'+safe(stop.name)+'</strong>'+
      '<p class="caption">'+safe(stop.category)+'</p>'+stop.details.map(detail=>'<p class="detail">'+safe(detail)+'</p>').join('')+
      (stop.source ? outbound(stop.source,'查看来源') : '')+'</div></li>').join('')+'</ul>' : '<p class="detail">当天尚无可列出的行程项目。</p>')+
    (day.missing.length ? '<p class="callout">待确认：'+safe(day.missing.join('、'))+'</p>' : '')+'</section>').join('');
  return '<details class="chinese-preview"><summary><span>Программа на китайском</span><span lang="zh-Hans">中文行程</span></summary>'+
    '<div class="chinese-body"><div lang="zh-Hans"><h3>'+safe(itinerary.title)+'</h3><p class="caption">'+safe(itinerary.group)+'</p>'+
    '<p class="callout">'+safe(itinerary.status)+'</p>'+days+'<section class="chinese-preparation"><h4>出发前请确认</h4><ul>'+
    itinerary.preparation.map(item=>'<li>'+safe(item)+'</li>').join('')+'</ul></section></div>'+
    '<button type="button" class="button-quiet" data-action="download-chinese"'+(review.dirty||review.loading?' disabled':'')+
    '>Скачать программу (.txt)</button></div></details>';
}

function decisionJournal() {
  const recordItems = (data.decisions ?? []).toSorted((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return '<section class="panel route-journal"><div class="section-head"><h2>Журнал решений</h2></div>'+
    (recordItems.length ? recordItems.map(decision=>
      '<details><summary><span><strong>'+safe(decision.title)+'</strong><span class="caption">'+date(decision.settings.date)+' · '+
      decision.settings.size+' чел. · '+(decision.settings.demo?'Учебная программа':'Рабочая программа')+'</span></span>'+
      '<span class="caption">Согласовано '+timestamp(decision.createdAt)+'</span></summary><div class="route-days">'+
      decision.plan.days.map((day,i)=>renderDay(day,i,decision.settings,decision.id)).join('')+'</div>'+
      (decision.settings.market==='zh' ? '<button type="button" class="button-quiet journal-download" data-action="download-chinese" data-decision="'+
        safe(decision.id)+'">Скачать программу на китайском (.txt)</button>' : '')+'</details>').join('') :
      '<p class="detail">Здесь появятся версии программ, согласованные специалистом.</p>')+'</section>';
}

function routeWorkbench(plan) {
  const timetable = displayTimetable(plan);
  const evidence = routeEvidence(plan);
  const showVariants = Boolean(!timetable.publishedPreview || review.loading || review.error || review.variants?.length);
  const showAssistant = !timetable.publishedPreview || review.variants?.length>=2;
  return '<p class="callout pilot-previous-result">'+safe(t('Показан предыдущий расчёт по применённым параметрам. Пересчитайте программу, чтобы сверить расписание и погоду.'))+'</p>'+
    pilotReadiness(plan,evidence,timetable)+(showVariants?routeVariants():'')+
    '<div class="route-review'+(showAssistant?'':' route-review--single')+'">'+routeDecision(plan,timetable)+
    (showAssistant?routeAssistant():'')+'</div>'+
    (plan.settings.demo ? '' : officialRouteReview(evidence))+decisionJournal();
}

function currentRoutePlan() {
  return selectedVariant()?.plan ?? review.preview ?? planRoute(data.places,options);
}

function displayTimetable(plan) {
  return plan.completeness || plan.settings.demo ? plan : previewPublishedRoute(data.places,plan.settings) ?? plan;
}

function attachPilotWeather(plan) {
  const placeById = new Map(data.places.map(place=>[place.id,place]));
  const outdoor = stop=>['golden-gate','wood'].includes(stop.id) || ['hike','nature'].includes(placeById.get(stop.id)?.theme);
  const indoor = stop=>placeById.get(stop.id)?.theme==='museum' && !outdoor(stop);
  const days = displayTimetable(plan).days.map((day,index)=>{
    const currentOutdoor = day.stops.some(outdoor);
    const variant = currentOutdoor && review.variants?.find(item=>{
      const other = item.plan.days[index];
      return other?.date===day.date && other.city===day.city && other.stops.some(indoor) && !other.stops.some(outdoor);
    });
    return {date:day.date,coordinates:geodata.cities?.[day.city]?.coordinates,
      outdoors:currentOutdoor || ['hike','nature'].includes(plan.settings.theme),
      alternative:variant?{variant:variant.id}:null};
  });
  loadPlanWeather($('.route-program'),days,api);
}

function routeView(plan) {
  const direction = routeDirections.find(item=>item.id===(options.direction ?? 'vladimir-suzdal')) ?? routeDirections[0];
  const localizedDirection = item=>item.translations[localeTag()] ?? item.translations[getLocale()] ?? item;
  const mapLink = !plan.settings.demo ? '<a class="button-quiet" id="pilot-map-link"></a>' : '';
  return head(t('Проверка программы'),t('Сопоставить даты, группу и условия'),mapLink)+
    '<div class="route-layout"><form id="route-form" class="panel route-options"><h2>Параметры</h2>'+
    '<label class="field">Направление<select name="direction">'+routeDirections.map(item=>selectOption(item.id,localizedDirection(item).title,direction.id)).join('')+
    '</select><small class="caption">'+safe(localizedDirection(direction).description)+'</small></label>'+
    '<label class="field">Дата начала<input name="date" type="date" min="2000-01-01" max="2099-12-31" required value="'+safe(options.date)+'"></label>'+
    '<label class="field">Длительность<select name="days">'+selectOption(2,'2 дня',options.days)+selectOption(3,'3 дня',options.days)+'</select></label>'+
    '<label class="field">Размер группы<input name="size" type="number" min="1" max="100" required value="'+options.size+'"></label>'+
    '<label class="field">Группа<select name="market">'+selectOption('zh','Группа из Китая',options.market)+selectOption('ru','Российская группа',options.market)+'</select></label>'+
    '<label class="field">Формат поездки<select name="theme">'+Object.entries(routeThemes).filter(([key])=>direction.themes.includes(key)||options.theme===key)
      .map(([value,label])=>selectOption(value,t(label),options.theme)).join('')+'</select></label>'+
    '<label class="check"><input type="checkbox" name="access" '+(options.access?'checked':'')+'>Безбарьерный доступ</label>'+
    (options.demo ? '<div class="inline-mode">'+chip(t('Учебные данные'),'warn')+
      '<button type="button" class="link-button" data-action="live-conditions">'+safe(t('Проверить по опубликованным условиям'))+'</button></div>' : '')+
    '<button type="submit" class="button">Рассчитать варианты</button>'+
    '<p class="caption route-dirty" id="pilot-route-dirty" role="status"'+(review.dirty?'':' hidden')+'>Пересчитайте варианты с новыми параметрами.</p></form>'+
    '<div class="route-workbench" id="route-workbench" data-dirty="'+review.dirty+'">'+routeWorkbench(plan)+'</div></div>';
}

function updatePilotMapLink(plan) {
  const link = $('#pilot-map-link');
  if (!link) return;
  link.textContent=t(review.dirty?'Пересчитайте программу для карты':'Открыть программу на карте');
  if (review.dirty) {
    link.removeAttribute('href');
    link.setAttribute('role','link');
    link.setAttribute('tabindex','0');
    link.setAttribute('aria-disabled','true');
    link.setAttribute('aria-describedby','pilot-route-dirty');
  } else {
    link.href='#impact?'+pilotParameters(plan?.settings ?? options,selectedVariant()?.id);
    for (const name of ['role','tabindex','aria-disabled','aria-describedby']) link.removeAttribute(name);
  }
}

function repaintWorkbench() {
  const workspace = $('#route-workbench');
  if (!workspace) return;
  const restoreReadinessFocus = document.activeElement?.id==='pilot-readiness-title';
  const returnToPassport = workspace.contains(document.activeElement) ? passportFocus(document.activeElement) : null;
  const chineseOpen = workspace.querySelector('.chinese-preview')?.open;
  const plan = currentRoutePlan();
  updatePilotMapLink(plan);
  workspace.innerHTML = routeWorkbench(plan);
  localizeDom(workspace);
  attachPilotWeather(plan);
  const preview = workspace.querySelector('.chinese-preview');
  if (preview && chineseOpen) preview.open = true;
  if (restoreReadinessFocus) $('#pilot-readiness-title')?.focus({preventScroll:true});
  restorePassportFocus(returnToPassport);
}

function downloadChinese(decisionId) {
  if (!decisionId && (review.dirty || review.loading)) return;
  const plan = decisionId ? data.decisions?.find(item=>item.id===decisionId)?.plan : currentRoutePlan();
  if (!plan) return;
  const itinerary = chineseItinerary(decisionId ? plan : displayTimetable(plan));
  if (!itinerary) return;
  const file = new Blob(['\uFEFF',chineseItineraryText(itinerary)],{type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'turcontour-'+plan.settings.date+'-zh-CN.txt';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function loadAlternatives() {
  const requested = review;
  cancelRouteAnalysis();
  requested.loading = true;
  requested.error = '';
  repaintWorkbench();
  try {
    const result = await api('alternatives',options);
    requested.variants = result.options;
    const matching = requested.preview && requested.variants.find(variant=>scheduleKey(variant.plan)===scheduleKey(requested.preview));
    const preferred = requested.preferredVariantId && requested.variants.find(variant=>variant.id===requested.preferredVariantId);
    requested.selectedId = (preferred || matching || requested.variants[0])?.id;
  } catch(error) {
    requested.error = error.message;
  } finally {
    requested.loading = false;
    if (requested===review) repaintWorkbench();
  }
}

function cancelRouteAnalysis(announce=false) {
  if (!activeRouteAnalysis) return false;
  const request=activeRouteAnalysis;
  activeRouteAnalysis=null;
  clearInterval(request.timer);
  request.controller.abort();
  if (announce) request.review.analysis={status:'cancelled',message:'Запрос отменён.',suggestions:[]};
  return true;
}

async function requestRouteAnalysis() {
  const requested = review;
  if (requested.dirty || activeRouteAnalysis) return;
  const request={review:requested,controller:new AbortController(),startedAt:Date.now()};
  activeRouteAnalysis=request;
  requested.analysis = null;
  repaintWorkbench();
  $('[data-action="cancel-route-ai"]')?.focus({preventScroll:true});
  request.timer=setInterval(()=>updateAiWait($('.route-assistant'),request.startedAt),1000);
  try {
    const result=await api('route-ai',{settings:options,brief:requested.brief,programId:requested.program?.id},'POST',{signal:request.controller.signal});
    if (activeRouteAnalysis===request) requested.analysis=result;
  } catch(error) {
    if (activeRouteAnalysis===request) requested.analysis={status:'unavailable',
      message:error.status ? error.message : 'Запрос не завершился. Повторите попытку.',suggestions:[]};
  } finally {
    if (activeRouteAnalysis===request) {
      activeRouteAnalysis=null;
      clearInterval(request.timer);
      if (requested===review && page()==='route' && params().get('scope')==='pilot') {
        const restoreFocus=document.activeElement===$('[data-action="cancel-route-ai"]');
        repaintWorkbench();
        if (restoreFocus) $('#route-ai-form [type=submit]')?.focus({preventScroll:true});
      }
    }
  }
}

async function approveRoute() {
  const requested = review;
  const variant = selectedVariant();
  if (requested.dirty || !variant?.signature || !variant.plan.completeness) return;
  const tracked = data.affected.find(record=>record.id===requested.program?.id);
  const programId = tracked && sameSettings(tracked.settings,options) ? tracked.id : undefined;
  let result;
  try {
    result = await api('approve',{settings:options,variantId:variant.id,planSignature:variant.signature,programId});
  } catch(error) {
    if (error.status===409 && requested===review) {
      requested.preview = variant.plan;
      requested.analysis = null;
      await loadAlternatives();
    }
    throw error;
  }
  data.decisions = result.decisions;
  requested.approval = {...result.decision,planSignature:variant.signature};
  if (result.data) data = result.data;
  if (requested===review && page()==='route') {
    repaintWorkbench();
    $('#route-program-title')?.focus({preventScroll:true});
  } else if (page()==='impact') {
    atlas?.update(data);
  }
  toast('Согласованная программа сохранена.');
}

function statisticsSource(status,checkedAt) {
  const text = status==='live' ? 'Обновлено из источника' : status==='error' ? 'Последний доступный снимок' : 'Начальный снимок';
  return '<p class="caption statistics-source">'+chip(t(text),status==='error'?'warn':status==='live'?'':'plain')+
    (checkedAt ? ' '+safe(t('Проверка источника: {time}',{time:timestamp(checkedAt)})) : '')+'</p>';
}

function agentView() {
  if (!agent) return '';
  const summary = agent.summary;
  const original = '<p class="detail" lang="ru" data-source-text>'+safe(agent.text)+'</p>';
  const full = summary?.years.filter(year=>year.total!==null) ?? [];
  const selected = (full.length ? full : summary?.years ?? []).map(year=>year.year).join(', ');
  const brief = summary?.mixedMethodology ? t('Ряды показаны отдельно по годам.') :
    summary?.lows.length ? t('Месяцы с наименьшими средними значениями за {years}',{years:selected}) :
    t('В подключённой выгрузке нет сопоставимых месячных значений за запрошенный период.');
  const output = summary && getLocale()!=='ru' ? '<p class="detail">'+safe(brief)+'</p>'+
    (summary.lows.length ? '<ul class="rows">'+summary.lows.map(({month,value})=>'<li>'+safe(statisticsMonth(month))+' · '+
      safe(formatNumber(value))+' '+safe(t(summary.unit))+'</li>').join('')+'</ul>' : '')+
    '<details><summary class="link-button">'+safe(t('Исходный ответ на русском'))+'</summary>'+original+'</details>' :
    t(agent.text)!==agent.text ? '<p class="detail">'+safe(t(agent.text))+'</p>' : original;
  const detail = summary ? '<p class="caption">'+outbound(summary.source,t('Ряд Roschart'))+' · '+outbound(summary.publication,t('Первоисточник Росстат'))+
    ' · '+safe(summary.edition)+' · '+safe(t('Данные получены {time}',{time:timestamp(summary.checkedAt)}))+'</p>'+
    statisticsSource(agent.sourceStatus,agent.sourceCheckedAt)+(agent.note ? '<p class="caption">'+safe(t(agent.note))+'</p>' : '')+
    (summary.years.length?statisticChart(summary):'') : '';
  const view = ['impact','route'].includes(agent.view) ? '<a href="#'+agent.view+'">'+safe(t(agent.view==='impact'?'Открыть мониторинг':'Открыть маршрут'))+'</a>' : '';
  return '<div class="ask-result" aria-live="polite"><h3>'+safe(t(agent.title))+'</h3>'+output+
    '<p class="caption status-line">'+safe(t(agent.plan.mode))+'</p>'+detail+view+'</div>';
}

function stats() {
  const pilot=statistics.regionId==='83';
  const provider=statistics.result;
  const stored=data[metric];
  const availableYears=stored.availableYears ?? stored.years;
  const selectedYears=statistics.period==='full' ? [] : [Number(statistics.period)];
  const series=pilot?statSummary({...stored,years:availableYears},selectedYears):provider?.summary;
  const regionControl='<label class="field">'+safe(t('Территория'))+'<select id="stat-region"'+(statistics.regions?'':' disabled')+'>'+
    statisticRegionsMarkup()+'</select></label>';
  const available=series?.years.length ? '<h2>'+safe(t(series.name))+'</h2><p class="caption">'+safe(t(statistics.period==='full' && !series.mixedMethodology?
    'Средние по полным календарным годам':'Месячные значения'))+'</p>'+
    statisticChart(series)+'<p class="caption status-line">'+outbound(series.publication,t('Росстат'))+' · '+outbound(series.source,t('Выгрузка через Roschart'))+
    ' · '+safe(series.edition)+' · '+safe(timestamp(series.checkedAt))+'</p>'+
    (!pilot && provider.sourceStatus==='cached' ? '<p class="caption">'+safe(t('Ряд из сохранённой копии'))+'</p>' :
      statisticsSource(pilot?data.sources[metric]?.status:provider.sourceStatus,pilot?data.sources[metric]?.checkedAt:provider.sourceCheckedAt)) :
    '<p class="empty" role="status">'+safe(t(statistics.loading?'Загружаем региональный ряд…':provider?.reason==='rate-limit'?
      'Лимит запросов к источнику достигнут.':'Нет доступных месячных данных для этого субъекта.'))+'</p>'+
    (provider?.sources?.length?'<p class="caption">'+provider.sources.map(entry=>outbound(entry.url,t(entry.title))).join(' · ')+'</p>':'');
  return head(t('Сезонность размещения'),t('Росстат · месячные ряды средств размещения'),pilot ? button(t('Обновить источники'),'refresh',true) : '')+
    '<div class="grid"><section class="panel"><div class="filters">'+regionControl+'<label class="field">'+safe(t('Показатель'))+'<select id="metric">'+
    selectOption('nights',t('Ночёвки'),metric)+selectOption('people',t('Размещённые лица'),metric)+'</select></label>'+
    '<label class="field">'+safe(t('Период'))+'<select id="stat-period">'+selectOption('full',t('Последние три полных года'),statistics.period)+
    availableYears.map(year=>String(year.year)).toReversed().map(year=>selectOption(year,year,statistics.period)).join('')+
    '</select></label></div>'+available+'</section>'+
    '<section class="panel"><h2>'+safe(t('Спросить ИИ по статистике'))+'</h2>'+
    (pilot?'<p class="caption">'+
    safe(t('Ночёвки и размещённые лица во Владимирской области.'))+'</p><form id="ask-form" class="ask"><input aria-label="'+
    safe(t('Запрос к агенту'))+'" type="text" name="question" required maxlength="600" placeholder="'+safe(t('Например, когда меньше ночёвок?'))+
    '"><button type="submit" class="button">'+safe(t('Спросить'))+'</button></form>'+
    '<button type="button" class="link-button sample" data-sample="В какие месяцы меньше всего ночёвок за последние три полных года?">'+
    safe(t('Минимум ночёвок за три года'))+'</button><br><button type="button" class="link-button sample" '+
    'data-sample="Как менялось число размещённых лиц за последние три полных года?">'+safe(t('Динамика размещённых лиц за три года'))+'</button>'+agentView() :
    '<div class="actions spaced"><a class="button-quiet" href="#ask?region='+safe(statistics.regionId)+'">'+
      safe(t('Задать вопрос по региону'))+'</a></div>')+'</section></div>';
}

function statisticRegionsMarkup() {
  const regions=statistics.regions??[{id:'83',name:'Владимирская область'}];
  return regions.map(region=>selectOption(region.id,t(itemName(region)),statistics.regionId)).join('');
}

async function loadStatRegions() {
  if (statistics.lookup || statistics.regions) return;
  statistics.lookup=api('stat-regions');
  try {
    statistics.regions=(await statistics.lookup).regions;
    const select=$('#stat-region');
    if (select) {select.innerHTML=statisticRegionsMarkup();select.disabled=false;}
  } catch { /* The installed Vladimir series remains available. */ }
  finally { statistics.lookup=null; }
}

async function loadRegionStatistics() {
  const version=++statistics.version;
  statistics.loading=statistics.regionId!=='83';
  statistics.result=null;
  render();
  if (!statistics.loading) return;
  try {
    const result=await api('regional-statistics',{regionId:statistics.regionId,metric,
      years:statistics.period==='full'?[]:[Number(statistics.period)]});
    if (statistics.version===version) statistics.result=result;
  } catch { /* An unavailable series has its own empty state. */ }
  finally {
    if (statistics.version===version) {
      statistics.loading=false;
      if (page()==='stats') {
        const focused=document.activeElement?.id;
        render();
        if (['metric','stat-region','stat-period'].includes(focused)) $('#'+focused)?.focus({preventScroll:true});
      }
    }
  }
}

function offerPanel() {
  const {date:arrival,occupancy,result} = offerSearch;
  const places = new Map(data.places.map(place=>[place.id,place.name]));
  const providers = new Map(result?.providers.map(provider=>[provider.id,provider.name]));
  return '<section class="panel ota-panel"><div class="section-head"><h2>'+safe(t('Предложения размещения'))+'</h2>'+chip(t('Учебные данные'),'warn')+'</div>'+
    '<p class="detail">'+safe(t('Сопоставляем две учебные выгрузки OTA по дате заезда. Для группы свободные номера и условия нужно подтвердить у отеля.'))+'</p>'+
    '<form class="filters ota-form" id="ota-form"><label class="field">'+safe(t('Дата заезда'))+
    '<input type="date" name="arrival" required value="'+safe(arrival)+'"></label><label class="field">'+safe(t('Гостей в номере'))+
    '<select name="occupancy">'+selectOption(1,t('1 гость'),occupancy)+selectOption(2,t('2 гостя'),occupancy)+
    '</select></label><button type="submit" class="button-quiet">'+safe(t('Сравнить предложения'))+'</button></form>'+
    (result ? '<div aria-live="polite">'+(result.coverage==='snapshot' ? '<ul class="rows">'+result.objects.map(stay=>(
      '<li><h3 lang="ru" data-source-text>'+safe(places.get(stay.id)??stay.id)+'</h3>'+stay.offers.map(offer=>
        '<p class="detail"><span data-source-text>'+safe(providers.get(offer.providerId))+'</span> · '+
        safe(t('{price} ₽ за ночь · {rooms} ном. в выгрузке',{price:formatNumber(offer.priceRub),rooms:formatNumber(offer.roomsListed)}))+'</p>'
      ).join('')+'</li>')).join('')+'</ul>' : '<p class="callout">'+safe(t('На эту дату и состав номера в учебных выгрузках нет данных.'))+'</p>')+
      '<p class="caption">'+result.providers.map(provider=>'<span data-source-text>'+safe(provider.name)+'</span> · '+safe(provider.version)+
        ' · '+safe(timestamp(provider.checkedAt))).join('<br>')+'</p></div>' :
      '<p class="caption">'+safe(t('Выгрузки покрывают сценарий 21–22 ноября 2026 года.'))+'</p>')+
    '<p class="caption ota-source">'+outbound('/api/demo-offers-source',t('Открыть учебные выгрузки'))+' '+
    safe(t('· Данные об отелях учитываются по объектам каталога.'))+'</p></section>';
}

function sources() {
  const known = [['nights','Ночёвки · Росстат через Roschart',data.nights.source],['people','Размещённые лица · Росстат через Roschart',data.people.source],
    ['wiki','Названия и координаты · Wikidata','https://www.wikidata.org/wiki/Wikidata:Data_access']];
  const sourceRows = known.map(([key,name,url])=>{
    const entry = data.sources[key];
    const status = entry?.status==='live' ? chip(t('Подключён')) : entry?.status==='error' ? chip(t('Последняя копия'),'warn') : chip(t('Начальный снимок'),'plain');
    return '<li><div class="row"><div><h3>'+outbound(url,t(name))+'</h3><p class="caption">'+safe(timestamp(entry?.checkedAt))+
      (entry?.status==='error'?' · <span data-source-text lang="ru">'+safe(entry.message)+'</span>':'')+'</p></div>'+status+'</div></li>';
  });
  const feed = data.auditFeed;
  const published = data.publishedConditions;
  const feedLabel = {live:'Подключена', error:'Ошибка обновления', pending:'Ожидает проверки'};
  const stage = data.auditVersion==='2';
  const changeValue = value=>typeof value==='number' ? formatNumber(value) : t(val(value));
  const changes = data.changes.map(change=>'<li><div class="row"><div><h3 lang="ru" data-source-text>'+safe(change.name)+'</h3><p class="detail">'+
    safe(t(change.field))+' · '+safe(changeValue(change.before))+' → '+safe(changeValue(change.after))+'</p><p class="caption">'+
    outbound(change.url,t(change.source))+' · '+safe(timestamp(change.at))+'</p></div>'+
    (change.demo ? chip(t('Учебное изменение'),'warn') : chip(t('Из внешнего источника')))+'</div></li>').join('');
  const feedValue = feed?.enabled && feed.snapshotAt ?
    t('Снимок от {time} · объектов: {count}',{time:timestamp(feed.snapshotAt),count:formatNumber(feed.objectCount ?? 0)}) :
    t(feed?.enabled?'Ожидаем доступный снимок с подтверждёнными условиями.':'Нет подключённой выгрузки с подтверждёнными условиями.');
  const practice = '<details class="panel practice"'+(stage?' open':'')+'><summary>'+safe(t('Учебный пример'))+'</summary>'+
    '<p class="detail">'+safe(t('В учебном примере лимит Суздальского кремля снижается с 25 до 12 человек. Можно проверить влияние на две группы. Опубликованные условия музея сохраняются.'))+'</p>'+
    '<div class="section-head">'+button(t(stage?'Сбросить учебный пример':'Запустить учебный пример'),'demo',true)+
    '<a href="#impact?program=group-cn">'+safe(t('Открыть учебную программу на карте'))+'</a></div>'+
    '<p class="caption">'+outbound('/api/audit-version/'+data.auditVersion,t('Учебный аудит · версия {version}',{version:data.auditVersion}))+'</p></details>';
  const mapping = '<section class="panel"><h2>'+safe(t('Картографические источники'))+'</h2><ul class="rows">'+
    '<li><h3>'+outbound('https://www.geonames.org/export/','GeoNames')+'</h3><p class="caption">'+safe(t('Города, координаты и часовые пояса'))+
    '</p></li><li><h3>'+outbound('https://wiki.openstreetmap.org/wiki/Overpass_API','OpenStreetMap · Overpass')+'</h3><p class="caption">'+
    safe(t('Места и категории OpenStreetMap по запросу; при сбое — геопоиск Wikimedia и сохранённые записи.'))+'</p>'+
    '<p class="caption">'+outbound('https://www.mediawiki.org/wiki/API:Geosearch','MediaWiki GeoSearch')+' · '+
    safe(t('Графики и запись сверяются по паспорту поставщика.'))+'</p></li></ul></section>';
  return head(t('Источники'))+'<div id="source-console" class="stack"></div>'+
    '<details class="panel source-legacy"><summary>'+safe(t('Журнал изменений'))+'</summary>'+
    '<div class="grid"><section class="panel"><div class="section-head">'+button(t('Обновить источники'),'refresh',true)+'</div>'+
    (changes ? '<ul class="rows">'+changes+'</ul>' : '<p class="empty">'+safe(t('Изменений не зафиксировано.'))+'</p>')+'</section>'+
    '<div class="stack"><section class="panel"><div class="section-head"><h2>'+safe(t('Автоматические подключения'))+'</h2></div><ul class="rows">'+sourceRows.join('')+
    (feed ? '<li><div class="row"><div><h3>'+safe(t('Выгрузка условий визита'))+'</h3><p class="caption">'+safe(feedValue)+
      '</p></div>'+chip(t(feed.enabled ? feedLabel[feed.state] : 'Не подключена'),feed.state==='live'?'':feed.state==='error'?'warn':'plain')+'</div></li>' : '')+
    '</ul></section>'+(published?.objectCount ? '<section class="panel"><h2>'+safe(t('Опубликованные условия посещения'))+'</h2><p class="detail">'+
    safe(t('Сверены сведения по {count} объектам · {date}.',{count:formatNumber(published.objectCount),date:date(published.checkedAt)}))+'</p>'+
    '<a href="#catalog">'+safe(t('Открыть каталог объектов'))+'</a></section>' : '')+mapping+'</div></div>'+practice+offerPanel()+'</details>';
}

function render(scroll=false) {
  if (!data) return;
  const current = page();
  const query = params();
  const isRoutePilot = current==='route' && query.get('scope')==='pilot';
  const priorForm = isRoutePilot && pilotRouteHash===location.hash && review.dirty ? $('#route-form') : null;
  if (!isRoutePilot) cancelRouteAnalysis(true);
  if (isRoutePilot && pilotRouteHash!==location.hash) {
    const pilot = readPilotParameters(query);
    if (pilot && (!sameSettings(pilot.settings,options) || pilot.variantId && pilot.variantId!==review.selectedId)) {
      options=pilot.settings;
      review=newReview();
      review.preferredVariantId=pilot.variantId;
    }
  }
  pilotRouteHash=isRoutePilot ? location.hash : null;
  document.title = t(labels[current])+' — ТурКонтур';
  document.querySelectorAll('.top nav a').forEach(a=>{
    if (a.hash==='#'+current) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  document.body.classList.toggle('atlas-page',current==='impact');
  if (composer) { composer.destroy(); composer=null; }
  if (knowledge) { knowledge.destroy(); knowledge=null; }
  if (cityOverview) { cityOverview.destroy(); cityOverview=null; }
  if (current==='impact') {
    if (atlas && atlasHash!==location.hash) saveMapContext();
    if (atlas) atlas.update(data);
    else {
      const pilot = readPilotParameters(query);
      const saved = mapContexts.get(location.hash);
      atlas=mountAtlas(screen,data,geodata,{
        programId:query.get('program'),
        placeId:query.get('place'),
        initialLayer:query.get('layer'),
        pilot,
        restored:pilot && scroll && saved?.group!=='working-pilot' ? undefined : saved,
        onOpenRoute(settings,program,context) {
          options=settings;
          review=newReview(program,context);
          location.hash='route?scope=pilot';
        },
        onOpenPlace(id,settings,offset,stop,trigger) { placeDetails(id,null,offset,settings,stop,trigger); },
      });
    }
    atlasHash=location.hash;
  } else {
    if (atlas) saveMapContext();
    if (current==='overview') cityOverview=mountCityOverview(screen,api,{initialCity:query.get('city'),
      renderChart:statisticChart,renderMonitoring:()=>renderMonitoredProgrammes(data,overview)});
    else if (current==='ask') knowledge=mountKnowledge(screen,api,options,query.get('region'),query.get('city'));
    else if (current==='route' && params().get('scope')!=='pilot') composer=mountComposer(screen,api,query.get('city'));
    else {
      const plan = current==='route' ? currentRoutePlan() : null;
      screen.innerHTML = {catalog,route:()=>routeView(plan),stats,sources}[current]();
      if (current==='sources') mountSourceConsole($('#source-console'),api);
      if (current==='stats') void loadStatRegions();
      if (plan) {
        if (priorForm) for (const field of $('#route-form').elements) {
          const prior = field.name && priorForm.elements.namedItem(field.name);
          if (!prior) continue;
          if (field.type==='checkbox') field.checked=prior.checked;
          else field.value=prior.value;
        }
        updatePilotMapLink(plan);
        attachPilotWeather(plan);
        if (!review.variants && !review.loading && !review.error) void loadAlternatives();
      }
    }
  }
  localizeDom(screen);
  if (scroll) {
    clearTimeout(toastTimer);
    $('#toast').hidden=true;
    window.scrollTo(0,0);
    $('#content').focus({preventScroll:true});
    const focus = params().get('focus');
    if (current==='overview' && focus==='programmes') $('#ops-programmes')?.focus();
    if (current==='stats' && focus==='ask') $('#ask-form input')?.focus();
  }
}

function saveMapContext() {
  if (!atlas) return;
  mapContexts.set(atlasHash,atlas.context());
  if (mapContexts.size>20) mapContexts.delete(mapContexts.keys().next().value);
  atlas.destroy();
  atlas=null;
}

async function runAction(action,control) {
  if (busy) return;
  busy = true;
  if (control) control.disabled = true;
  try { await action(); }
  catch(error) { toast(error.message); }
  finally {
    busy = false;
    if (control) control.disabled = false;
  }
}

function readOptions(form) {
  const f = new FormData(form);
  return routeSettings({date:f.get('date'),days:f.get('days'),size:f.get('size'),market:f.get('market'),theme:f.get('theme'),
    direction:f.get('direction'),access:f.has('access'),demo:options.demo});
}

function updatePilotLinkState() {
  if (options.demo || !readPilotParameters(params())) return;
  pilotRouteHash='#route?'+pilotParameters(options,selectedVariant()?.id);
  history.replaceState(null,'',pilotRouteHash);
}

screen.addEventListener('submit',event=>{
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('[type=submit]');
  if (form.id==='ota-form') runAction(async()=>{
    const fields = new FormData(form);
    const date = fields.get('arrival');
    const occupancy = Number(fields.get('occupancy'));
    const result = await api('demo-offers',{date,occupancy});
    offerSearch = {date,occupancy,result};
    if (page()==='sources') {
      $('.ota-panel').outerHTML = offerPanel();
      $('#ota-form button').focus({preventScroll:true});
    }
  },button);
  if (form.id==='route-form') {
    if (busy) return;
    options = readOptions(form);
    review = newReview(null,review.program);
    updatePilotLinkState();
    render();
    $('#pilot-readiness-title')?.focus();
  }
  if (form.id==='route-ai-form') void requestRouteAnalysis();
  if (form.id==='ask-form') runAction(async()=>{
    const input = form.elements.question;
    const question = input.value;
    button.textContent = 'Анализ…';
    try {
      agent = await api('ask',{question,settings:options});
      if (agent.summary) data = await api('state');
      if (page()==='stats') {
        render();
        $('#ask-form').elements.question.value = question;
      }
    } finally { button.textContent = 'Спросить'; }
  },button);
});

screen.addEventListener('click',event=>{
  const target = event.target.closest('[data-action],[data-place],[data-sample]');
  if (!target) return;
  if (target.dataset.action==='overview-filter' || target.dataset.action==='overview-change') {
    const key = target.dataset.action==='overview-filter' ? 'filter' : 'selected';
    overview[key] = target.dataset.value;
    cityOverview?.refreshMonitoring();
    [...screen.querySelectorAll('[data-action="'+target.dataset.action+'"]')]
      .find(button=>button.dataset.value===target.dataset.value)?.focus({preventScroll:true});
  }
  if (target.dataset.place) placeDetails(target.dataset.place,target.dataset.decision,Number(target.dataset.placeDay),null,null,target);
  if (target.dataset.action==='select-variant') {
    if (busy) return;
    review.selectedId = target.dataset.variant;
    updatePilotLinkState();
    const fromAi = target.closest('.route-assistant')!==null;
    repaintWorkbench();
    const selector = fromAi ? '.route-ai-suggestions [aria-pressed=true]' : '.route-variant[aria-pressed=true]';
    $(selector)?.focus({preventScroll:true});
  }
  if (target.dataset.action==='retry-variants') void loadAlternatives();
  if (target.dataset.action==='cancel-route-ai' && cancelRouteAnalysis(true)) {
    repaintWorkbench();
    $('#route-ai-form [type=submit]')?.focus({preventScroll:true});
  }
  if (target.dataset.action==='live-conditions') {
    options={...options,demo:false};
    review=newReview();
    render();
    $('#route-form [name=date]')?.focus();
  }
  if (target.dataset.action==='approve-route') runAction(approveRoute,target);
  if (target.dataset.action==='download-chinese') downloadChinese(target.dataset.decision);
  if (target.dataset.sample) {
    const form = $('#ask-form');
    form.elements.question.value = target.dataset.sample;
    form.requestSubmit();
  }
  if (target.dataset.action==='refresh') runAction(async()=>{
    target.textContent = 'Проверяем источники…';
    try {
      data = await api('refresh',{});
      review = newReview(null,review.program);
      const feed = data.auditFeed?.enabled ? data.auditFeed : null;
      const ok = ['wiki','nights','people'].filter(key=>data.sources[key]?.status==='live').length + Number(feed?.state==='live');
      toast('Обновлено '+ok+' из '+(feed ? '4' : '3')+' источников.'+
        (feed?.state==='error' ? ' Выгрузку условий визита проверить не удалось.' : ''));
      render();
    } finally { target.textContent = 'Обновить источники'; }
  },target);
  if (target.dataset.action==='demo') runAction(async()=>{
    data = await api('audit',{version:data.auditVersion==='1'?'2':'1'});
    review = newReview();
    overview.filter=data.auditVersion==='2'?'impact':'external';
    overview.selected=null;
    toast(data.auditVersion==='2'?'Лимит обновлён. Программы пересчитаны.':'Восстановлены исходные учебные условия.');
    render();
  },target);
});

screen.addEventListener('input',event=>{
  if (event.target.id==='search') {
    filters.search = event.target.value;
    $('#catalog-rows').innerHTML = catalogRows();
    localizeDom($('#catalog-rows'));
  }
  if (['catalog-date','catalog-size'].includes(event.target.id)) {
    const dateField=$('#catalog-date');
    const sizeField=$('#catalog-size');
    const status=$('#catalog-conditions-status');
    if (!dateField.validity.valid || !sizeField.validity.valid) {
      const applied=catalogSettings();
      status.textContent=t('Исправьте дату или размер группы. Каталог пока показывает условия на {date} для группы из {size} чел.',
        {date:date(applied.date),size:formatNumber(applied.size)});
    } else {
      filters.date=dateField.value;
      filters.size=Number(sizeField.value);
      status.textContent='';
      $('#catalog-rows').innerHTML=catalogRows();
      localizeDom($('#catalog-rows'));
    }
  }
  if (event.target.form?.id==='route-form') {
    const form = event.target.form;
    review.dirty = !form.checkValidity() || !sameSettings(readOptions(form),options);
    $('#route-workbench').dataset.dirty=String(review.dirty);
    if (review.dirty && cancelRouteAnalysis(true)) repaintWorkbench();
    $('.route-dirty').hidden = !review.dirty;
    updatePilotMapLink();
    const approve = $('[data-action="approve-route"]');
    if (approve) approve.disabled = review.dirty || busy;
    const compare = $('#route-ai-form [type=submit]');
    if (compare) compare.disabled = review.dirty || Boolean(activeRouteAnalysis);
    const download = $('.chinese-preview [data-action="download-chinese"]');
    if (download) download.disabled = review.dirty || review.loading;
  }
  if (event.target.form?.id==='route-ai-form') review.brief = event.target.value;
});
screen.addEventListener('change',event=>{
  const input = event.target;
  if (['kind','status','city'].includes(input.id)) {
    filters[input.id] = input.value;
    $('#catalog-rows').innerHTML = catalogRows();
    localizeDom($('#catalog-rows'));
  }
  if (input.id==='metric') {
    metric = input.value;
    void loadRegionStatistics();
    $('#metric').focus();
  }
  if (input.id==='stat-region') {
    statistics.regionId=input.value;
    void loadRegionStatistics();
    $('#stat-region')?.focus();
  }
  if (input.id==='stat-period') {
    statistics.period=input.value;
    void loadRegionStatistics();
    $('#stat-period')?.focus();
  }
  if (input.name==='direction' && input.form?.id==='route-form') {
    if (!input.form.reportValidity()) {
      input.value=options.direction ?? 'vladimir-suzdal';
      return;
    }
    const direction = routeDirections.find(item=>item.id===input.value);
    const previous = readOptions(input.form);
    options=routeSettings({...previous,direction:direction.id,theme:direction.theme});
    review=newReview();
    updatePilotLinkState();
    render();
    $('#route-form [name=direction]').focus();
  }
});
dialog.addEventListener('click',event=>{
  if (event.target===dialog||event.target.closest('[data-action=close]')) dialog.close();
});
dialog.addEventListener('close',()=>{
  restorePassportFocus(passportReturn);
  passportReturn=null;
});
$('.skip').addEventListener('click',event=>{
  event.preventDefault();
  $('#content').focus();
});
window.addEventListener('hashchange',()=>render(true));
const language = $('#locale');
setLocale(getLocale());
language.value = getLocale();
localizeDom(document);
language.closest('label').querySelector('.sr-only').textContent = t('Язык');
language.setAttribute('aria-label',t('Язык'));
language.addEventListener('change',()=>{
  setLocale(language.value);
  if (atlas) saveMapContext();
  if (dialog.open) dialog.close();
  localizeDom(document.querySelector('.top'));
  localizeDom(document.querySelector('footer'));
  language.closest('label').querySelector('.sr-only').textContent=t('Язык');
  language.setAttribute('aria-label',t('Язык'));
  render();
});

try {
  [data, geodata] = await Promise.all([api('state'), api('map').catch(()=>({}))]);
  render();
  if (!data.refreshedAt) setTimeout(async()=>{
    const screenIsIdle=()=>!busy && !dialog.open && !activeRouteAnalysis && !knowledge?.waiting &&
      !screen.contains(document.activeElement);
    if (screenIsIdle()) {
      try {
        data = await api('state');
        // The national planner owns its requests and does not depend on dashboard data.
        if (!composer && screenIsIdle()) render();
      } catch { /* last rendered state remains usable */ }
    }
  },8000);
} catch(error) {
  screen.innerHTML = '<p role="alert">'+safe(error.message)+'</p>';
} finally { screen.setAttribute('aria-busy','false'); }
