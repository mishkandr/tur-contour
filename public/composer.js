import { createRouteMap } from '/map.js';
import { addLocaleMessages, formatDate, formatNumber, getLocale, t } from '/locale.js';
import { aiWaitingMarkup, updateAiWait } from '/knowledge.js';
import { loadPlanWeather, weatherExport, weatherSlot } from '/weather.js';

addLocaleMessages([
  ['Конструктор маршрутов','Itinerary builder','行程编制'],
  ['По России','Across Russia','俄罗斯全境'],
  ['Владимирская область · проверка','Vladimir Oblast · verification','弗拉基米尔州 · 核查'],
  ['Опишите, что нужно группе','Describe what the group needs','描述团队需求'],
  ['Собрать маршрут','Build itinerary','编制行程'],
  ['Пересчитать маршрут','Rebuild itinerary','重新计算行程'],
  ['Уточнить условия с ИИ','Refine requirements with AI','用人工智能细化条件'],
  ['Ввести параметры вручную','Enter details manually','手动输入参数'],
  ['Изменить параметры','Edit requirements','编辑参数'],
  ['Программа по дням','Day-by-day itinerary','每日行程'],
  ['Параметры по умолчанию: {date}, {days} дня, {size} чел.','Defaults: {date}, {days} days, {size} people.','默认参数：{date}，{days} 天，{size} 人。'],
  ['Дата начала · {date} · {days} дня · {size} чел.','Starts {date} · {days} days · {size} people','{date} 出发 · {days} 天 · {size} 人'],
  ['Смотрим даты, группу и города в запросе…','Reading dates, group size and cities…','正在读取日期、团队人数与城市…'],
  ['ИИ уточняет условия…','AI is refining the requirements…','人工智能正在细化条件…'],
  ['Подбираем объекты и составляем программу…','Finding places and building the itinerary…','正在查找地点并安排行程…'],
  ['Запрос отменён. Введённые параметры сохранены.','Request cancelled. Your input is still here.','请求已取消，已输入条件保留。'],
  ['Укажите до трёх городов для одного маршрута.','Enter no more than three cities for one itinerary.','一个行程最多可选三个城市。'],
  ['Измените запрос или откройте параметры и выберите город.','Edit your request or open the form and pick a city.','请修改需求，或打开参数并选择城市。'],
  ['Программа для проверки','Itinerary for review','待核实行程'],
  ['Перед выездом','Before departure','出发前'],
  ['Карта и источники','Map and sources','地图和数据源'],
  ['Обязательная остановка','Required stop','必到地点'],
  ['Варианты замены','Replacement candidates','替换候选'],
  ['Заменить на {place}','Replace with {place}','替换为 {place}'],
  ['Предположительно в помещении','Likely indoors','可能位于室内'],
  ['Предположительно на улице','Likely outdoors','可能位于室外'],
  ['Тип площадки нужно уточнить','Check whether the venue is indoors','请核查地点是否位于室内'],
  ['Условия для группы нужно подтвердить','Confirm conditions for the group','团队接待条件待确认'],
  ['Время остановок зависит от подтверждённого прибытия в город.',
    'Stop times depend on the confirmed arrival in the city.','停留时间取决于团队抵达城市的确认时间。'],
  ['Оценка для автомобиля · {minutes} мин. Выезд {departure} · прибытие {arrival} по местному времени.',
    'Driving estimate · {minutes} min. Depart {departure} · arrive {arrival} in local time.','自驾预计 {minutes} 分钟。当地时间 {departure} 出发，{arrival} 抵达。'],
  ['Расчёт по прямой при {speed} км/ч с запасом {buffer} мин. Сверьте фактический переезд.',
    'Based on straight-line distance at {speed} km/h plus a {buffer} min buffer. Confirm the actual trip.',
    '按直线距离、{speed} 公里/小时及 {buffer} 分钟缓冲计算。请确认实际行车安排。'],
  ['После расчётного прибытия остаётся меньше времени на посещения.',
    'Less time remains for visits after the estimated arrival.','按预计抵达时间，可用于参观的时间较少。'],
  ['Расчётный переезд заканчивается после этой даты. Для посещений нужен дополнительный день или другой транспорт.',
    'The estimated transfer ends after this date. Allow another day or use a different form of transport for visits.',
    '预计抵达时间晚于该日期。如要安排参观，请增加一天或更换交通方式。'],
  ['Объекты вне расписания','Unscheduled venue options','行程之外的备选地点'],
  ['Безбарьерный доступ указан на карте','Step-free access indicated on the map','地图标记可无障碍通行'],
  ['По карте доступ частичный','Limited step-free access on the map','地图标记无障碍通行受限'],
  ['Уточнить безбарьерный доступ','Check step-free access','请核查无障碍通行条件'],
  ['Источник сведений об объекте','Source of venue data','地点信息来源'],
  ['Официальный сайт объекта','Official venue website','地点官方网站'],
  ['Замену не удалось поставить на то же время. Программа сохранена.','The replacement no longer fits the same time slot. Your itinerary is unchanged.','替换地点不再适合该时段，原行程已保留。'],
  ['Часть прежних замен больше не подходит к новым параметрам. Проверьте расписание.','Some previous replacements no longer fit the new requirements. Review the schedule.','部分先前的替换不再符合新参数，请核查日程。'],
  ['Проверяем замену для этого времени…','Checking the replacement for this time slot…','正在核验替换地点是否适合此时段…'],
  ['Найдено несколько совпадений: {places}. Уточните название и город.','Several matches: {places}. Specify the place and city.','找到多个匹配地点：{places}。请注明地点与城市。'],
  ['Объект вне зоны выбранного транспорта','Place lies outside the selected transport radius','地点超出所选交通方式的范围'],
  ['Точка исключена вручную','Place was manually excluded','地点已手动排除'],
  ['В расписании нет подходящего времени','No suitable time slot in the itinerary','行程中无合适时段'],
  ['Обед · подтвердить для группы','Lunch · confirm for the group','午餐 · 待确认团队安排'],
  ['Обед в том же месте · подтвердить для группы','Lunch at the same venue · confirm for the group','在同一地点用午餐 · 待确认团队安排'],
  ['Ночёвка · подтвердить для группы','Overnight stay · confirm for the group','住宿 · 待确认团队安排'],
  ['Та же гостиница · подтвердить вторую ночь','Same hotel · confirm the additional night','同一家酒店 · 待确认续住'],
  ['Переезды по городу · около {minutes} мин','Local transfers · around {minutes} min','市内交通 · 约 {minutes} 分钟'],
  ['Переезд к точке · около {minutes} мин, {distance} км по прямой','Transfer to the stop · about {minutes} min, {distance} km straight-line','前往此站 · 约 {minutes} 分钟，直线距离 {distance} 公里'],
  ['Входные данные изменились. Запустите расчёт снова.','Inputs changed. Start a new calculation.','条件已更改，请重新计算。'],
  ['Показан предыдущий расчёт. Пересчитайте маршрут, чтобы сверить расписание и погоду по новым параметрам.',
    'This is the previous calculation. Rebuild the itinerary to check the schedule and weather with the new requirements.',
    '此处显示上次计算结果。请重新编制行程，以便按新条件核查日程和天气。'],
  ['В запросе неверная дата {value}. Исправьте её в запросе или укажите дату в параметрах.',
    'The date {value} in your request is invalid. Correct it in the request or set a date in the form.',
    '需求中的日期 {value} 无效。请更正日期，或在参数中重新选择。'],
  ['В запросе {value} чел. Укажите размер группы от 1 до 100 человек.',
    'The request specifies {value} people. Enter a group size from 1 to 100.',
    '需求中的团队人数为 {value}。请输入 1 至 100 人。'],
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
  ['Можно выбрать до 10 обязательных объектов. Уберите лишние из списка.','You can choose up to ten required places. Remove some from the list.','最多可选十个必到地点，请从列表中移除多余地点。'],
  ['Названия через запятую','Names separated by commas','用逗号分隔名称'],
  ['Китайскоязычное сопровождение','Chinese-language support','中文服务'],
  ['Безбарьерный доступ','Step-free access','无障碍通行'],
  ['ИИ разобрал запрос. Проверьте поля.','AI interpreted the request. Review the fields.','人工智能已解析需求，请核对字段。'],
  ['Параметры заполнены автоматически. ИИ сейчас недоступен.','Fields filled automatically. AI is currently unavailable.','已自动填写参数，人工智能暂不可用。'],
  ['Запрошено {days} дней. Здесь можно собрать программу на 2 или 3 дня.','Your request specifies {days} days. Choose a two- or three-day draft.','需求为 {days} 天，您可选择生成两天或三天行程。'],
  ['Типы посещений','Visit types','参观类型'],
  ['История и архитектура','History and architecture','历史与建筑'],
  ['Музеи','Museums','博物馆'],
  ['Семейная поездка','Family itinerary','亲子行程'],
  ['Романтическая поездка','Romantic itinerary','浪漫行程'],
  ['Природа','Nature','自然'],
  ['Пеший маршрут','Hiking and walking','徒步'],
  ['Ремёсла','Crafts','工艺'],
  ['Гастрономическая поездка','Food tour','美食之旅'],
  ['Татарская кухня · Казань','Tatar cuisine · Kazan','鞑靼美食 · 喀山'],
  ['Найти отель или ресторан','Find a hotel or restaurant','查找酒店或餐厅'],
  ['Название отеля или ресторана','Hotel or restaurant name','酒店或餐厅名称'],
  ['Что ищем','Venue type','地点类型'],
  ['Все варианты','All venues','所有地点'],
  ['Отели','Hotels','酒店'],
  ['Рестораны','Restaurants','餐厅'],
  ['Город поиска','Search city','搜索城市'],
  ['Все города маршрута','All itinerary cities','行程中的所有城市'],
  ['Места и условия для группы подтвердите у отеля или ресторана.',
    'Confirm availability and group conditions with the hotel or restaurant.','请向酒店或餐厅确认可用名额和团队接待条件。'],
  ['По этому запросу подходящие отели и рестораны не найдены.',
    'No hotels or restaurants match this search.','未找到符合搜索条件的酒店或餐厅。'],
  ['Сбросить фильтры','Clear filters','清除筛选条件'],
  ['В каталоге пока нет отелей и ресторанов для этого маршрута.',
    'The catalog has no hotels or restaurants for this itinerary yet.','此行程的目录中暂没有酒店或餐厅。'],
  ['Показать ещё','Show more','显示更多'],
  ['В расписании · {when}','In the itinerary · {when}','已列入日程 · {when}'],
  ['Нет времени в расписании','No available slot in the itinerary','行程中没有可用时段'],
  ['Маршрут пересчитан. Проверьте время выбранного места.','Itinerary updated. Check the venue’s scheduled time.','行程已更新。请核对所选地点的安排时间。'],
  ['Маршрут пересчитан. Для выбранного места нет подходящего времени.','Itinerary updated. No suitable slot was found for the selected venue.','行程已更新。所选地点没有合适的时段。'],
  ['Снято требование включить это место.','This venue is no longer required.','已取消该地点的必选要求。'],
  ['Обязательный выбор','Required selection','必选地点'],
  ['Включить в маршрут','Include in itinerary','加入行程'],
  ['Убрать из обязательных','Remove requirement','取消必选'],
  ['Пересчитываем маршрут с выбранным местом…','Recalculating with the selected venue…','正在按所选地点重新计算…'],
  ['Паломничество','Pilgrimage','朝圣'],
  ['Черновик','Draft','草案'],
  ['Карта черновика','Draft map','行程草案地图'],
  ['Целиком','Fit itinerary','显示全程'],
  ['Все дни','All days','所有日期'],
  ['Темы','Interests','主题'],
  ['Исключить типы посещений','Exclude visit types','排除参观类型'],
  ['Учтённые темы','Requested interests covered','已覆盖的主题'],
  ['{count} точек','{count} places','{count} 个地点'],
  ['{count} точка','{count} place','{count} 个地点'],
  ['{count} точки','{count} places','{count} 个地点'],
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
  ['Википедия','Wikipedia','维基百科'],
  ['Wikidata и сайты объектов','Wikidata and venue websites','维基数据与地点官网'],
  ['Другие города маршрута','Other cities in the itinerary','行程中的其他城市'],
  ['Добавить город','Add a city','添加城市'],
  ['Название следующего города','Next city name','下一座城市的名称'],
  ['Добавить {city}','Add {city}','添加 {city}'],
  ['В маршруте уже есть этот город.','This city is already in the itinerary.','此城市已在行程中。'],
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
  nature:'Природа',hike:'Пеший маршрут',craft:'Ремёсла',pilgrimage:'Паломничество',gastro:'Гастрономическая поездка'};
const kind = {visit:'Посещение',food:'Питание',stay:'Размещение'};
const delayedArrival='Расчётный переезд заканчивается после этой даты. Для посещений нужен дополнительный день или другой транспорт.';
const shorterVisits='После расчётного прибытия остаётся меньше времени на посещения.';
const safe = value=>String(value ?? '').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const tr = (value,vars)=>safe(t(value,vars));
const name = item=>getLocale()==='zh' ? item.cn || item.name : getLocale()==='en' ? item.en || item.name : item.name;
const regionName = city=>getLocale()==='zh' ? city.regionCn || city.region : getLocale()==='en' ? city.regionEn || city.region : city.region;
const currentDate = ()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'});
const initialRequirements = date=>({date,days:2,size:8,interests:[],transport:'mixed',
  pace:'normal',market:'ru',access:false,required:[],excludedInterests:[],visitDeadline:null});
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
  ['Татарская кухня · Казань',
    ['Казань на два дня для 8 человек. Гастротур с татарской кухней. Обязательно Музей чак-чака.',
      'Two days in Kazan for 8 people. Food tour featuring Tatar cuisine. Must visit the Chak-Chak Museum.',
      '喀山两天，8人，鞑靼美食之旅。必须参观恰克恰克博物馆。']],
];
const state = {
  brief:'',lastAppliedBrief:'',query:'',cities:[],selectedCity:null,extraCities:[],settings:initialRequirements(currentDate()),
  result:null,mapDay:'all',point:null,dirty:false,
  revision:0,note:'',noteValues:null,findVersion:0,pointDay:null,unsupportedDays:null,invalidDate:null,invalidSize:null,
  omitted:[],replacements:[],overrideFields:[],requiredServices:[],
};
const cacheKey='tur-contour.current-draft.v1';
try {
  const saved=JSON.parse(sessionStorage.getItem(cacheKey)??'null');
  if (saved?.settings && saved?.result?.plan?.days?.length) {
    Object.assign(state,saved);
  }
} catch { /* A disabled or full session store leaves the current page usable. */ }

function retainDraft() {
  if (!state.result) return;
  const {brief,lastAppliedBrief,query,cities,selectedCity,extraCities,settings,result,mapDay,point,pointDay,dirty,omitted,
    unsupportedDays,invalidDate,invalidSize,replacements,overrideFields,requiredServices} = state;
  try {sessionStorage.setItem(cacheKey,JSON.stringify({brief,lastAppliedBrief,query,cities,selectedCity,extraCities,settings,result,
    mapDay,point,pointDay,dirty,omitted,unsupportedDays,invalidDate,invalidSize,replacements,overrideFields,requiredServices}));}
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
  return '<div class="composer-inputs"><form id="draft-input" class="panel composer-form" novalidate>'+
    '<label class="field composer-request"><span>'+tr('Опишите, что нужно группе')+'</span><textarea name="brief" aria-describedby="draft-defaults" rows="4" maxlength="600" placeholder="'+
    tr('Например: Казань на три дня, 12 человек, музеи и неспешные прогулки')+'">'+safe(state.brief)+'</textarea></label>'+
    '<p class="caption" id="draft-defaults"></p><div class="composer-primary"><button type="submit" class="button">'+tr(state.result?'Пересчитать маршрут':'Собрать маршрут')+'</button>'+
    '<button type="button" class="link-button" data-composer="refine">'+tr('Уточнить условия с ИИ')+'</button></div>'+
    '<div id="composer-progress" hidden></div><p id="draft-status" class="caption" role="status">'+(state.note ? tr(state.note,state.noteValues) : '')+'</p>'+
    '<details class="brief-examples"><summary>'+tr('Примеры запросов')+'</summary><ul>'+examples.map(([label],index)=>
      '<li><button class="button-quiet" type="button" data-composer="example" data-value="'+index+'">'+tr(label)+'</button></li>').join('')+
    '</ul></details><details id="draft-parameters"><summary>'+tr(state.result?'Изменить параметры':'Ввести параметры вручную')+'</summary>'+
    '<div class="composer-parameters">'+
    '<label class="field composer-city"><span>'+tr('Город начала')+'</span><input id="city-query" type="search" value="'+
    safe(state.query)+'" placeholder="'+tr('Название города')+'" autocomplete="off" aria-controls="city-results"></label>'+
    '<div id="city-results"></div><div id="draft-additional-cities"></div><div id="draft-omitted"></div>'+
    '<details id="draft-add-city" hidden><summary>'+tr('Добавить город')+'</summary>'+
    '<label class="field">'+tr('Название следующего города')+
    '<input id="extra-city-query" type="search" autocomplete="off" maxlength="100" aria-controls="extra-city-results"></label>'+
    '<div id="extra-city-results"></div></details>'+
    '<div class="composer-fields"><label class="field">'+tr('Дата начала')+
    '<input type="date" name="date" min="2000-01-01" max="2099-12-31" value="'+safe(settings.date)+'" required></label>'+
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
    '<label class="field">'+tr('Обязательные объекты')+'<input name="required" maxlength="1000" placeholder="'+tr('Названия через запятую')+
    '" value="'+safe(settings.required.join(', '))+'"></label></div>'+
    '<label class="field composer-visit-deadline">'+tr('Закончить посещения до')+'<input type="time" min="09:00" max="18:00" name="visitDeadline" value="'+
    safe(settings.visitDeadline??'')+'"></label>'+
    '<label class="check"><input type="checkbox" name="china"'+(settings.market==='zh'?' checked':'')+'>'+tr('Китайскоязычное сопровождение')+'</label>'+
    '<label class="check"><input type="checkbox" name="access"'+(settings.access?' checked':'')+'>'+tr('Безбарьерный доступ')+'</label>'+
    '</details></div></details></form></div>';
}

function eligibility(item) {
  if (item.reason==='ambiguous') return t('Найдено несколько совпадений: {places}. Уточните название и город.',
    {places:item.candidates.map(candidate=>candidate.name+' ('+candidate.city+')').join(', ')});
  if (item.reason==='out-of-range') return t('Объект вне зоны выбранного транспорта');
  if (item.reason==='omitted') return t('Точка исключена вручную');
  if (item.reason==='no-slot') return t('В расписании нет подходящего времени');
  return t(item.scheduled ? 'Объект включён' : item.accessBlocked ? 'По данным карты безбарьерного доступа нет' :
    item.omitted || item.excludedInterests?.length ? 'Исключено по требованиям' :
    item.matched ? 'Объект не попал в расписание' : 'Объект не найден в данных');
}

function requirementName(item) {
  if (!item.requestedId) return item.label;
  const selected=state.requiredServices.find(place=>place.id===item.requestedId);
  return selected ? name(selected) : item.matched?.name ?? item.label;
}

function gapLabel(message) {
  if (message.startsWith('Согласовать переезд ')) return t('Междугородний переезд нужно подтвердить.');
  const cutoff = /^Часть посещений не помещается до (\d{2}:\d{2})\./u.exec(message);
  return cutoff ? t('Часть посещений не помещается до {time}. Уточните время или уменьшите число остановок.',{time:cutoff[1]}) : t(message);
}

function dayGaps(day) {
  return day.missing.filter(message=>!(day.transfer && message.startsWith('Согласовать переезд ')) &&
    !(day.logistics?.arrivalAfterDay && message===delayedArrival) &&
    !(day.transfer?.timing?.visitsLimited && message===shorterVisits)).map(gapLabel);
}

function evidenceSources(result) {
  return (result.sources?.length ? result.sources : [result.source]).flatMap(source=>
    source.supplemental ? [source,{...source.supplemental,city:source.city}] : [source]);
}

function placeCount(count) {
  const category=new Intl.PluralRules(getLocale()).select(count);
  return t(category==='one'?'{count} точка':category==='few'?'{count} точки':'{count} точек',{count:formatNumber(count)});
}

function coverageMarkup(coverage) {
  if (!coverage?.length) return '';
  return '<div class="composer-coverage"><h3>'+tr('Учтённые темы')+'</h3><ul>'+coverage.map(({theme,count})=>
    '<li><strong>'+tr(themes[theme]??theme)+'</strong><span class="chip '+(count?'':'warn')+'">'+
    safe(count?placeCount(count):t('Подходящие точки не найдены'))+'</span></li>').join('')+'</ul></div>';
}

function dayLogistics(day) {
  if (!day.logistics) return [];
  const {lunch,overnight,estimatedTransferMinutes}=day.logistics;
  return [
    ...(lunch.status==='suggested' ? [t(lunch.repeated?'Обед в том же месте · подтвердить для группы':'Обед · подтвердить для группы')] : []),
    ...(overnight.status==='suggested' ? [t(overnight.action==='return'?'Та же гостиница · подтвердить вторую ночь':'Ночёвка · подтвердить для группы')] : []),
    ...(estimatedTransferMinutes ? [t('Переезды по городу · около {minutes} мин',{minutes:formatNumber(estimatedTransferMinutes)})] : []),
  ];
}

function transferNotes(day,result) {
  const transfer=day.transfer;
  const delayed = day.logistics?.arrivalAfterDay ? [t(delayedArrival)] : [];
  if (!transfer) return delayed;
  const timing=transfer.timing;
  const distance=t('{from} → {to} · {distance} км по прямой',{
    from:name(result.locations?.find(city=>city.id===transfer.fromId)??{name:transfer.from}),
    to:name(result.locations?.find(city=>city.id===transfer.toId)??{name:transfer.to}),distance:formatNumber(transfer.distanceKm)});
  const estimated=timing?.status==='estimated' && timing.departureTime && timing.arrivalTime;
  const local=(date,time)=>date && date!==day.date?formatDate(date)+' '+time:time;
  const notes=estimated ? [
    t('Оценка для автомобиля · {minutes} мин. Выезд {departure} · прибытие {arrival} по местному времени.',{
      minutes:formatNumber(timing.reserveMinutes),departure:local(timing.departureDate,timing.departureTime),
      arrival:local(timing.arrivalDate,timing.arrivalTime)}),
    t('Расчёт по прямой при {speed} км/ч с запасом {buffer} мин. Сверьте фактический переезд.',{
      speed:formatNumber(timing.assumedSpeedKmh),buffer:formatNumber(timing.bufferMinutes)}),
  ] : [t('Время остановок зависит от подтверждённого прибытия в город.')];
  if (timing?.visitsLimited && !delayed.length) notes.push(t(shorterVisits));
  return [distance,...notes,...delayed];
}

function transferMarkup(day,result) {
  const notes=transferNotes(day,result);
  if (!notes.length) return '';
  if (!day.transfer) return '<div class="composer-transfer"><p>'+safe(notes[0])+'</p></div>';
  const [distance,...detail]=notes;
  const candidates=day.transfer.candidates ?? [];
  return '<div class="composer-transfer"><p><strong>'+safe(distance)+'</strong></p>'+detail.map(note=>'<p>'+safe(note)+'</p>').join('')+
    (candidates.length?'<details><summary>'+tr('Объекты вне расписания')+'</summary><ul>'+candidates.map(candidate=>
      '<li><a href="'+safe(candidate.url)+'" target="_blank" rel="noopener noreferrer" data-source-text>'+safe(name(candidate))+'</a></li>').join('')+
      '</ul></details>':'')+'</div>';
}

function forecastDays(result, dirty=false) {
  return result.plan.days.map(day=>{
    const city = result.locations?.find(location=>location.id===day.cityId) ?? result.location;
    const outdoors = day.stops.filter(stop=>stop.exposure==='outdoors');
    const stop = !dirty && outdoors.find(item=>item.alternatives?.some(candidate=>candidate.exposure==='indoors'));
    return {date:day.date,coordinates:day.logistics?.arrivalAfterDay ? null : city?.coordinates,
      outdoors:outdoors.length>0 || result.plan.settings.interests?.some(theme=>['hike','nature'].includes(theme)),
      alternative:stop?{stop,name:name(stop)}:null};
  });
}

function accessEvidence(requireAccess,place) {
  if (!requireAccess) return '';
  return t(place?.wheelchairHint==='yes'?'Безбарьерный доступ указан на карте':
    place?.wheelchairHint==='limited'?'По карте доступ частичный':'Уточнить безбарьерный доступ');
}

function replacementMarkup(stop,places,settings) {
  if (state.dirty || !stop.alternatives?.length) return '';
  const choices=stop.exposure==='outdoors' ? stop.alternatives.toSorted((a,b)=>Number(b.exposure==='indoors')-Number(a.exposure==='indoors')) :
    stop.alternatives;
  return '<details class="composer-alternatives"><summary>'+tr('Варианты замены')+'</summary><ul>'+choices.map((alternative,index)=>{
    const evidenceId='replacement-facts-'+index;
    const exposure=stop.type==='visit' ? t(alternative.exposure==='indoors'?'Предположительно в помещении':
      alternative.exposure==='outdoors'?'Предположительно на улице':'Тип площадки нужно уточнить') : '';
    const notes=[exposure,accessEvidence(settings.access,places.get(alternative.id)),t('Условия для группы нужно подтвердить')];
    return '<li><button type="button" class="link-button" aria-describedby="'+evidenceId+'" data-composer="replace-stop" data-previous="'+
      safe(stop.id)+'" data-value="'+safe(alternative.id)+'">'+tr('Заменить на {place}',{place:name(alternative)})+
      '</button><p class="caption" id="'+evidenceId+'">'+safe(notes.filter(Boolean).join(' · '))+'</p></li>';
  }).join('')+'</ul><div class="composer-swap-feedback">'+
    '<div class="composer-swap-progress" hidden></div><p class="caption composer-swap-status" role="status"></p></div></details>';
}

function serviceSearchMarkup(result,view) {
  const locations=result.locations ?? [result.location];
  return '<details id="draft-services" class="composer-services"'+(view.open?' open':'')+'><summary>'+tr('Найти отель или ресторан')+'</summary>'+
    '<div class="composer-service-fields"><label class="field">'+tr('Название отеля или ресторана')+
    '<input type="search" id="draft-service-query" value="'+safe(view.query)+'" maxlength="100"></label>'+
    '<label class="field composer-service-select">'+tr('Что ищем')+'<select id="draft-service-kind">'+
    options({all:'Все варианты',stay:'Отели',food:'Рестораны'},view.kind)+'</select></label>'+
    (locations.length>1?'<label class="field composer-service-select">'+tr('Город поиска')+'<select id="draft-service-city">'+
      '<option value="">'+tr('Все города маршрута')+'</option>'+locations.map(city=>
        '<option value="'+safe(city.name)+'"'+(view.city===city.name?' selected':'')+' data-source-text>'+safe(name(city))+'</option>').join('')+
      '</select></label>':'')+'</div><p class="caption">'+tr('Места и условия для группы подтвердите у отеля или ресторана.')+'</p>'+
    '<div class="composer-service-feedback"><div class="composer-swap-progress" hidden></div><p class="caption composer-swap-status" role="status"></p></div>'+
    '<div id="draft-service-list"></div></details>';
}

function draftMarkup(result,serviceView) {
  const {location,plan,settings} = result;
  const venues = result.locations ?? [location];
  const sources = evidenceSources(result).map(item=>{
    const status = item.status==='live' ? 'Внешний источник' : item.status==='snapshot' ? 'Сохранённый снимок' : 'Поиск объектов недоступен';
    const date = item.checkedAt && Number.isFinite(Date.parse(item.checkedAt)) ? ' · '+formatDate(item.checkedAt) : '';
    return '<li><a href="'+safe(item.url)+'" target="_blank" rel="noopener noreferrer">'+tr(item.name)+'</a>'+
      ' · '+tr(status)+safe(date)+(item.city && venues.length>1?' · '+safe(item.city):'')+'</li>';
  }).join('');
  return '<section class="panel composer-output" data-dirty="'+state.dirty+'" aria-labelledby="draft-title"><header class="composer-title"><div><p class="ops-kicker">'+
    tr('Программа для проверки')+'</p><h2 id="draft-title" tabindex="-1" data-source-text>'+safe(venues.map(name).join(' → '))+'</h2><p class="caption">'+
    safe(regionName(location))+' · '+tr('Дата начала · {date} · {days} дня · {size} чел.',{
      date:formatDate(settings.date),days:formatNumber(settings.days),size:formatNumber(settings.size)})+
    (settings.access?' · '+tr('Безбарьерный доступ'):'')+
    '</p></div></header><p class="callout composer-stale" role="status"'+(state.dirty?'':' hidden')+'>'+
    tr('Показан предыдущий расчёт. Пересчитайте маршрут, чтобы сверить расписание и погоду по новым параметрам.')+'</p>'+
    '<section class="composer-evidence"><h3>'+tr('Перед выездом')+'</h3><ul>'+
    plan.required.map(item=>'<li><span data-source-text>'+safe(requirementName(item))+'</span> · '+safe(eligibility(item))+'</li>').join('')+
    result.warnings.map(warning=>'<li>'+tr(warning)+'</li>').join('')+'</ul></section>'+
    coverageMarkup(plan.interestCoverage)+serviceSearchMarkup(result,serviceView)+
    '<div class="composer-day-head"><h3>'+tr('Программа по дням')+'</h3><div class="atlas-options" id="draft-days" role="group" aria-label="'+tr('Дни маршрута')+'"></div></div>'+
    '<div id="draft-timeline"></div><div class="composer-map-frame"><div class="atlas-map-top"><h3>'+tr('Карта и источники')+'</h3>'+
    '<button class="button-quiet" data-composer="fit" type="button">'+tr('Целиком')+'</button></div><div class="composer-map-scene">'+
    '<div id="draft-map" role="region" aria-label="'+tr('Карта черновика')+'"></div></div></div><ul class="caption composer-source">'+sources+
    '<li><a href="'+safe(location.sourceUrl)+'" target="_blank" rel="noopener noreferrer">GeoNames</a></li></ul>'+
    '<div class="composer-export"><button class="button-quiet" type="button" data-composer="export"'+
    (state.dirty?' disabled':'')+'>'+tr('Скачать черновик')+'</button></div></section>';
}

function download(result) {
  const {location,plan,settings,warnings} = result;
  const places = new Map(result.places.map(place=>[place.id,place]));
  const weather = weatherExport(forecastDays(result));
  const summary = t('Дата начала · {date} · {days} дня · {size} чел.',{
    date:formatDate(settings.date),days:formatNumber(settings.days),size:formatNumber(settings.size)});
  const lines = [t('Черновик')+' · '+(result.locations??[location]).map(name).join(' → '),summary,
    ...(settings.access?[t('Безбарьерный доступ')]:[]),
    ...evidenceSources(result).map(item=>t(item.name)+' · '+item.url), location.sourceUrl,'',
    ...plan.days.flatMap((day,index)=>[t('День {day}',{day:index+1})+' · '+formatDate(day.date)+' · '+(day.cityId ?
      name(result.locations?.find(item=>item.id===day.cityId)??location):name(location)),
      ...transferNotes(day,result),
      ...weather[index],...day.stops.map(stop=>{
        const place=places.get(stop.id);
        return [stop.start+'–'+stop.end+' '+name(stop),accessEvidence(settings.access,place),stop.url,
          place?.officialUrl && place.officialUrl!==stop.url ? t('Официальный сайт объекта')+' '+place.officialUrl : ''].filter(Boolean).join(' · ');
      }),...dayLogistics(day),...dayGaps(day),
      ...(day.transfer?.candidates?.length?[t('Объекты вне расписания'),...day.transfer.candidates.map(candidate=>name(candidate)+' · '+candidate.url)]:[]),'']),
    t('Проверка условий'),...warnings.map(t),...plan.required.map(item=>requirementName(item)+' · '+eligibility(item)),
    ...(plan.interestCoverage??[]).map(({theme,count})=>t(themes[theme]??theme)+' · '+
      (count?placeCount(count):t('Подходящие точки не найдены')))];
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
  let localizedGeodata;
  let searchTimer;
  let extraSearchTimer;
  let extraSearchVersion=0;
  let extraMatches=[];
  let pending;
  let mounted=true;
  const serviceView={open:false,query:'',kind:'all',city:'',limit:8};
  container.innerHTML = '<header class="page-head"><h1>'+tr('Конструктор маршрутов')+'</h1></header>'+
    itineraryTabs(false)+'<div class="composer-layout">'+formMarkup()+'<div class="composer-result" id="composer-result"></div></div>';
  const syncAdditionalCitiesControl=()=>{find('#draft-add-city').hidden=!state.selectedCity || state.extraCities.length>=2;};
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
    syncAdditionalCitiesControl();
    find('#draft-omitted').innerHTML=state.omitted.length ? '<p class="caption">'+tr('Исключённые точки')+'</p>'+
      '<ul class="composer-extra">'+state.omitted.map(place=>'<li><button type="button" class="button-quiet" data-composer="restore-stop" data-value="'+safe(place.id)+
      '" aria-label="'+tr('Вернуть {place}',{place:name(place)})+'"><span data-source-text>'+safe(name(place))+'</span> <span aria-hidden="true">↶</span></button></li>').join('')+'</ul>':'';
  }
  function searchAdditionalCity(query) {
    const results=find('#extra-city-results');
    const version=++extraSearchVersion;
    clearTimeout(extraSearchTimer);
    extraMatches=[];
    results.replaceChildren();
    if (query.length<2) return;
    extraSearchTimer=setTimeout(async()=>{
      try {
        const {cities}=await api('cities?q='+encodeURIComponent(query));
        if (!mounted || version!==extraSearchVersion) return;
        const chosen=new Set([state.selectedCity?.id,...state.extraCities.map(city=>city.id)]);
        extraMatches=cities.filter(city=>!chosen.has(city.id)).slice(0,5);
        results.innerHTML=extraMatches.length?'<ul class="composer-extra-city-results">'+extraMatches.map(city=>
          '<li><button type="button" class="button-quiet" data-composer="add-city" data-value="'+safe(city.id)+
          '"><span>'+tr('Добавить {city}',{city:name(city)})+'</span>'+
          (city.region?'<small>'+safe(regionName(city))+'</small>':'')+'</button></li>').join('')+'</ul>':
          '<p class="caption" role="status">'+tr(cities.length?'В маршруте уже есть этот город.':
            'Город не найден. Попробуйте другое написание.')+'</p>';
      } catch(error) {
        if (mounted && version===extraSearchVersion) results.textContent=t(error.message);
      }
    },250);
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
    showNote(state.note,state.noteValues);
    showDefaults();
  }
  function showDefaults() {
    const {date,days,size}=state.settings;
    if (!date || !Number.isFinite(Date.parse(date))) {find('#draft-defaults').textContent='';return;}
    const scope=state.selectedCity ? [state.selectedCity,...state.extraCities].map(name).join(' → ')+' · ' : '';
    find('#draft-defaults').textContent=scope+t(state.selectedCity ? 'Дата начала · {date} · {days} дня · {size} чел.' :
      'Параметры по умолчанию: {date}, {days} дня, {size} чел.',{date:formatDate(date),days,size});
  }
  function showNote(message, values) {
    if (!mounted) return;
    state.note=message;
    state.noteValues=values;
    find('#draft-status').textContent=message?t(message,values):'';
    const issue=parameterIssue();
    for (const name of ['date','size','days']) {
      const field=find('#draft-input').elements[name];
      if (name===issue?.field && message===issue.message) {
        field.setAttribute('aria-invalid','true');
        field.setAttribute('aria-describedby','draft-status');
      } else {
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');
      }
    }
  }
  function syncActions() {
    if (!mounted) return;
    const form=find('#draft-input');
    const submit=form.querySelector('[type=submit]');
    submit.disabled=Boolean(pending);
    submit.textContent=t(state.result?'Пересчитать маршрут':'Собрать маршрут');
    find('#draft-parameters > summary').textContent=t(state.result?'Изменить параметры':'Ввести параметры вручную');
    find('[data-composer=refine]').disabled=Boolean(pending) || state.brief.trim().length<3;
    for (const button of container.querySelectorAll('[data-composer=service-include],[data-composer=service-release]')) {
      button.disabled=Boolean(pending);
    }
  }
  function phase(label) {
    const node=pending.progress;
    node.innerHTML=aiWaitingMarkup(label,pending.startedAt,'cancel-composer');
    node.hidden=false;
  }
  function paintServices() {
    const list=find('#draft-service-list');
    if (!list || !state.result) return;
    const folded=value=>String(value ?? '').normalize('NFKC').toLocaleLowerCase().replaceAll('ё','е');
    const query=folded(serviceView.query.trim());
    const scheduled=state.result.plan.days.flatMap(day=>day.stops.map(stop=>[stop.id,{date:day.date,time:stop.start}]));
    const current=new Map(scheduled.reverse());
    const pinned=new Set(state.requiredServices.map(place=>place.id));
    const available=state.result.places;
    const missing=state.requiredServices.filter(place=>!available.some(item=>item.id===place.id));
    const places=[...available,...missing].filter(place=>['food','stay'].includes(place.kind) &&
      (serviceView.kind==='all' || serviceView.kind===place.kind) && (!serviceView.city || serviceView.city===place.city) &&
      [place.name,place.en,place.cn,...(place.aliases??[])].some(label=>folded(label).includes(query)));
    places.sort((a,b)=>Number(pinned.has(b.id))-Number(pinned.has(a.id)) ||
      Number(current.has(b.id))-Number(current.has(a.id)) || name(a).localeCompare(name(b),getLocale()));
    const visible=places.slice(0,serviceView.limit);
    const filtered=Boolean(query || serviceView.kind!=='all' || serviceView.city);
    list.innerHTML=visible.length ? '<ul class="composer-service-list">'+visible.map((place,index)=>{
      const mandatory=pinned.has(place.id);
      const city=state.result.locations?.find(location=>location.name===place.city);
      const when=current.get(place.id);
      const info=[t(kind[place.kind]),city?name(city):place.city,mandatory?t('Обязательный выбор'):'',
        when?t('В расписании · {when}',{when:formatDate(when.date)+' · '+when.time}):mandatory?t('Нет времени в расписании'):'',
        accessEvidence(state.result.settings.access,place)].filter(Boolean);
      const infoId='draft-venue-info-'+index;
      const venueId='draft-venue-name-'+index;
      const link=place.officialUrl??place.url;
      return '<li><div>'+(link?'<a id="'+venueId+'" target="_blank" rel="noopener noreferrer" href="'+safe(link)+'" data-source-text>'+safe(name(place))+
        '</a>':'<strong id="'+venueId+'" data-source-text>'+safe(name(place))+'</strong>')+'<p class="caption" id="'+infoId+'">'+safe(info.join(' · '))+
        '</p></div><button type="button" class="button-quiet" aria-describedby="'+venueId+' '+infoId+'" data-composer="'+
        (mandatory?'service-release':'service-include')+'" data-value="'+safe(place.id)+'"'+(pending?' disabled':'')+'>'+
        tr(mandatory?'Убрать из обязательных':'Включить в маршрут')+'</button></li>';
    }).join('')+'</ul>'+(places.length>visible.length?'<button type="button" class="button-quiet" data-composer="service-more">'+
      tr('Показать ещё')+'</button>':'') :
      '<p class="caption">'+tr(filtered?'По этому запросу подходящие отели и рестораны не найдены.':
        'В каталоге пока нет отелей и ресторанов для этого маршрута.')+'</p>'+
      (filtered?'<button type="button" class="button-quiet" data-composer="service-clear">'+tr('Сбросить фильтры')+'</button>':'');
  }
  function start(label, feedback) {
    const progress=feedback?.querySelector('.composer-swap-progress')??find('#composer-progress');
    const request={controller:new AbortController(),startedAt:Date.now(),progress,feedback};
    pending=request;
    request.timer=setInterval(()=>updateAiWait(progress,request.startedAt),1000);
    showNote('');
    if (feedback) feedback.querySelector('.composer-swap-status').textContent='';
    phase(label);
    syncActions();
    return request;
  }
  function finish(request) {
    if (pending!==request) return;
    clearInterval(request.timer);
    pending=null;
    if (!mounted) return;
    const node=request.progress;
    node.hidden=true;
    node.replaceChildren();
    syncActions();
  }
  const isCurrent = (request,revision)=>mounted && pending===request && state.revision===revision;
  function paintDays(frame=false) {
    const {plan,places} = state.result;
    const byId=new Map(places.map(place=>[place.id,place]));
    const days=plan.days.map((day,index)=>({day,index})).filter(({index})=>state.mapDay==='all'||String(index)===state.mapDay);
    const region=find('#draft-days');
    region.innerHTML = [['all',t('Все дни')],...plan.days.map((_day,i)=>[String(i),t('День {day}',{day:i+1})])]
      .map(([key,label])=>'<button class="atlas-option" type="button" data-composer="day" data-value="'+key+'" aria-pressed="'+(state.mapDay===key)+'">'+safe(label)+'</button>').join('');
    const included = new Set(days.flatMap(({day})=>day.stops.map(stop=>stop.id)));
    const visible=places.filter(place=>included.has(place.id));
    find('#draft-timeline').innerHTML = days.map(({day,index})=>'<section class="composer-day"><h3>'+tr('День {day}',{day:index+1})+
      ' · '+safe(formatDate(day.date))+(state.result.locations?.length>1?' · '+safe(name(state.result.locations.find(city=>city.id===day.cityId)??{name:day.city})): '')+
      '</h3>'+transferMarkup(day,state.result)+(day.logistics?.arrivalAfterDay?'':weatherSlot(index))+
      '<ul class="composer-logistics caption">'+dayLogistics(day).map(item=>'<li>'+safe(item)+'</li>').join('')+'</ul>'+
      '<ul class="composer-stops">'+day.stops.map(stop=>{
        const selected=state.point===stop.id && state.pointDay===index;
        const place=byId.get(stop.id);
        const notes=[t(stop.required?'Обязательная остановка':kind[stop.type]),accessEvidence(plan.settings.access,place)].filter(Boolean).join(' · ');
        return '<li><button type="button" data-composer="stop" data-value="'+safe(stop.id)+'" data-day="'+index+'" aria-pressed="'+selected+'">'+
          '<time>'+safe(stop.start)+'–'+safe(stop.end)+'</time><span data-source-text>'+safe(name(stop))+'</span><small>'+safe(notes)+'</small></button>'+
          (selected?'<div class="composer-stop-actions"><a href="'+safe(stop.url)+'" target="_blank" rel="noopener noreferrer">'+tr('Источник сведений об объекте')+'</a>'+
            (place?.officialUrl && place.officialUrl!==stop.url?
              '<a href="'+safe(place.officialUrl)+'" target="_blank" rel="noopener noreferrer">'+tr('Официальный сайт объекта')+'</a>':'')+
            (stop.leg?.minutes?'<span class="caption">'+tr('Переезд к точке · около {minutes} мин, {distance} км по прямой',{
              minutes:formatNumber(stop.leg.minutes),distance:formatNumber(stop.leg.distanceKm)})+'</span>':'')+
            (stop.required?'':'<button type="button" class="link-button" data-composer="pin-stop" data-value="'+safe(stop.id)+'">'+tr('Сделать обязательным')+'</button>')+
            '<button type="button" class="link-button" data-composer="omit-stop" data-value="'+safe(stop.id)+'">'+tr('Исключить точку')+'</button>'+
            replacementMarkup(stop,byId,plan.settings)+'</div>':'')+'</li>';
      }).join('')+
      '</ul>'+dayGaps(day).map(gap=>'<p class="caption">'+safe(gap)+'</p>').join('')+'</section>').join('');
    loadPlanWeather(find('#draft-timeline'),forecastDays(state.result,state.dirty),api);
    const mapDays=days.map(({day})=>state.mapDay!=='all' && day.stops.length ? {...day,transfer:undefined} : day);
    map?.update({places:visible,route:{...plan,days:mapDays},selectedId:state.point,
      dayIndex:state.mapDay==='all'?0:Number(state.mapDay),geodata:localizedGeodata,
      frame:frame?'route':false,base:'streets',locale:getLocale(),showPlaces:true});
    retainDraft();
  }
  function resultMarkup(focus=false) {
    if (!mounted) return;
    map?.destroy();
    if (!state.result) return;
    const previousServices=find('#draft-services');
    if (previousServices) serviceView.open=previousServices.open;
    if (serviceView.city && !state.result.locations?.some(place=>place.name===serviceView.city)) serviceView.city='';
    const {geodata}=state.result;
    localizedGeodata={...geodata,attribution:geodata.attribution?.map(credit=>({...credit,label:t(credit.label)}))};
    find('#composer-result').innerHTML=draftMarkup(state.result,serviceView);
    paintServices();
    map=createRouteMap(find('#draft-map'),{locale:getLocale(),minZoom:0,onSelect(id,_place,context){
      if (pending?.feedback) {pending.controller.abort();finish(pending);}
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
      required:[...new Set(String(fields.get('required')).split(/[,，;]/u).map(name=>name.trim()).filter(Boolean))]};
  }
  function setDirty() {
    state.revision+=1;
    if (!state.result) return;
    markStale();
    showNote('Параметры изменились. Соберите черновик заново.');
  }
  function markStale() {
    state.dirty=true;
    const output=find('.composer-output');
    if (output) {
      output.dataset.dirty='true';
      output.querySelector('.composer-stale').hidden=false;
    }
    const send=find('[data-composer=export]');
    if (send) send.disabled=true;
  }
  function parameterIssue() {
    if (state.invalidDate) return {field:'date',message:'В запросе неверная дата {value}. Исправьте её в запросе или укажите дату в параметрах.',values:{value:state.invalidDate}};
    if (state.invalidSize) return {field:'size',message:'В запросе {value} чел. Укажите размер группы от 1 до 100 человек.',values:{value:state.invalidSize}};
    if (state.unsupportedDays!=null) return {field:'days',message:'Запрошено {days} дней. Здесь можно собрать программу на 2 или 3 дня.',values:{days:state.unsupportedDays}};
    return null;
  }
  function applyParsing(result,message) {
    const {parsed,cities}=result;
    const resultSettings=initialRequirements(result.referenceDate ?? currentDate());
    for (const key of ['date','days','size','transport','pace','market','access','visitDeadline']) if (parsed[key]!=null) resultSettings[key]=parsed[key];
    resultSettings.interests=parsed.interests;
    resultSettings.required=parsed.required;
    resultSettings.excludedInterests=parsed.excludedInterests??[];
    for (const key of state.overrideFields) delete resultSettings[key];
    state.settings={...state.settings,...resultSettings};
    state.lastAppliedBrief=state.brief.trim();
    state.unsupportedDays=parsed.requestedDays!=null && !parsed.days && !state.overrideFields.includes('days') ? parsed.requestedDays : null;
    state.invalidDate=state.overrideFields.includes('date') ? null : parsed.invalidDate ?? null;
    state.invalidSize=state.overrideFields.includes('size') ? null : parsed.invalidSize ?? null;
    if (!state.overrideFields.includes('city')) {
      const previousIds=[state.selectedCity,...state.extraCities].filter(Boolean).map(city=>city.id).join(',');
      if (previousIds!==cities.map(city=>city.id).join(',')) {
        state.omitted=[];
        state.replacements=[];
        state.requiredServices=[];
      }
      clearTimeout(searchTimer);
      state.findVersion++;
      state.cities=cities;
      state.selectedCity=cities[0]??null;
      state.extraCities=cities.slice(1);
      state.query=state.selectedCity ? name(state.selectedCity) : '';
    }
    if (state.result) markStale();
    retainDraft();
    const issue=parameterIssue();
    state.note = issue?.message ?? (
      state.extraCities.length>2 ? 'Укажите до трёх городов для одного маршрута.' :
      state.extraCities.length && !state.overrideFields.includes('city') ? 'Несколько городов найдено в тексте. Проверьте порядок.' : message);
    state.noteValues=issue?.values ?? null;
    updateExtraction();
  }
  async function analyse() {
    if (pending || state.brief.trim().length<3) return;
    const request=start('ИИ уточняет условия…');
    const revision=state.revision;
    try {
      const deep=await api('brief',{text:state.brief.trim(),mode:'ai'},'POST',{signal:request.controller.signal});
      if (isCurrent(request,revision)) {
        applyParsing(deep,deep.mode==='ai'?'ИИ разобрал запрос. Проверьте поля.':
          'Параметры заполнены автоматически. ИИ сейчас недоступен.');
        find('#draft-parameters').open=true;
      }
    } catch(error) {
      if (isCurrent(request,revision)) showNote(error.message);
    } finally {
      finish(request);
    }
  }
  async function build(form,replacement,feedback,selectedServices,serviceChange) {
    if (pending) return;
    const brief=state.brief.trim();
    const parseNew = brief.length>=3 && brief!==state.lastAppliedBrief;
    const request=start(selectedServices?'Пересчитываем маршрут с выбранным местом…':replacement?'Проверяем замену для этого времени…':
      parseNew?'Смотрим даты, группу и города в запросе…':'Подбираем объекты и составляем программу…',feedback);
    const revision=++state.revision;
    const network={signal:request.controller.signal};
    try {
      if (parseNew) {
        const fast=await api('brief',{text:brief,mode:'rules'},'POST',network);
        if (!isCurrent(request,revision)) return;
        applyParsing(fast,'');
      }
      const issue=parameterIssue();
      if (issue || state.extraCities.length>2) {
        find('#draft-parameters').open=true;
        showNote(issue?.message ?? 'Укажите до трёх городов для одного маршрута.',issue?.values);
        (issue ? form.elements[issue.field] : find('#draft-additional-cities button'))?.focus();
        return;
      }
      if (!state.selectedCity && state.query.trim()) {
        const response=await api('cities?q='+encodeURIComponent(state.query),undefined,'GET',network);
        if (!isCurrent(request,revision)) return;
        state.cities=response.cities;
        const possible=state.cities.filter(city=>[city.name,city.en,city.cn,...(city.aliases??[])].some(value=>value?.toLowerCase()===state.query.trim().toLowerCase()));
        if (possible.length===1) state.selectedCity=possible[0];
        if (mounted) cityOptions(true);
      }
      if (!state.selectedCity) {
        find('#draft-parameters').open=true;
        showNote('Измените запрос или откройте параметры и выберите город.');
        (find('#city-id')??find('#city-query')).focus();
        return;
      }
      if (!form.checkValidity()) {
        find('#draft-parameters').open=true;
        find('#draft-advanced').open=true;
        form.reportValidity();
        return;
      }
      state.settings=settingsFrom(form);
      if (state.settings.required.length>10) {
        find('#draft-parameters').open=true;
        find('#draft-advanced').open=true;
        showNote('Можно выбрать до 10 обязательных объектов. Уберите лишние из списка.');
        form.elements.required.focus();
        return;
      }
      if (state.extraCities.length>=state.settings.days) {
        find('#draft-parameters').open=true;
        showNote('Городов больше, чем дней. Уберите лишние города или увеличьте длительность.');
        return;
      }
      if (parseNew) phase('Подбираем объекты и составляем программу…');
      const replacements=replacement ? [...state.replacements,replacement] : state.replacements;
      const services=selectedServices ?? state.requiredServices;
      const result=await api('draft',{...state.settings,cityId:state.selectedCity.id,additionalCityIds:state.extraCities.map(city=>city.id),
        omittedIds:state.omitted.map(place=>place.id),replacements,requiredPlaceIds:services.map(place=>place.id)},'POST',network);
      if (!isCurrent(request,revision)) return;
      const swaps=result.plan.replacements??[];
      const rejected=swaps.some(item=>item.status==='rejected') || swaps.length!==replacements.length;
      if (replacement && rejected) {
        feedback.querySelector('.composer-swap-status').textContent=t('Замену не удалось поставить на то же время. Программа сохранена.');
        return;
      }
      state.replacements=swaps.filter(item=>item.status==='applied').map(({day,fromId,toId})=>({day,fromId,toId}));
      state.requiredServices=services;
      state.result=result;
      state.mapDay=replacement?state.mapDay:'all';
      state.point=replacement?.toId??null;
      state.pointDay=replacement?.day??null;
      state.dirty=false;
      showNote(rejected?'Часть прежних замен больше не подходит к новым параметрам. Проверьте расписание.':'');
      resultMarkup(!replacement && !selectedServices);
      if (replacement) find('#draft-timeline button[aria-pressed=true]')?.focus();
      if (serviceChange) {
        const selection=result.plan.required.find(item=>item.requestedId===serviceChange);
        const status=selection ? (selection.scheduled ? 'Маршрут пересчитан. Проверьте время выбранного места.' :
          'Маршрут пересчитан. Для выбранного места нет подходящего времени.') : 'Снято требование включить это место.';
        find('.composer-service-feedback .composer-swap-status').textContent=t(status);
      }
    } catch(error) {
      if (isCurrent(request,revision)) {
        if (feedback) feedback.querySelector('.composer-swap-status').textContent=t(error.message);
        else showNote(error.message);
      }
    } finally {
      finish(request);
      if (serviceChange && mounted && state.revision===revision) {
        const target=[...container.querySelectorAll('#draft-service-list button[data-value]')]
          .find(button=>button.dataset.value===serviceChange);
        (target??find('#draft-services summary'))?.focus();
      }
    }
  }
  const submit = event=>{
    const form=event.target;
    if (form.id==='draft-input') {event.preventDefault();void build(form);}
  };
  const input = event=>{
    const control=event.target;
    if (control.id==='extra-city-query') {
      searchAdditionalCity(control.value.trim());
      return;
    }
    if (control.id==='draft-service-query' || control.id==='draft-service-kind' || control.id==='draft-service-city') {
      serviceView.query=find('#draft-service-query').value;
      serviceView.kind=find('#draft-service-kind').value;
      serviceView.city=find('#draft-service-city')?.value??'';
      serviceView.limit=8;
      paintServices();
      return;
    }
    if (control.form?.id!=='draft-input') return;
    if (pending) {
      pending.controller.abort();
      finish(pending);
      showNote('Входные данные изменились. Запустите расчёт снова.');
    }
    if (control.name==='brief') {
      state.brief=control.value;
      state.unsupportedDays=null;
      state.invalidDate=null;
      state.invalidSize=null;
      state.overrideFields=[];
      setDirty();
      syncActions();
      retainDraft();
      return;
    }
    const manual=({china:'market',interest:'interests',excludedInterest:'excludedInterests'})[control.name] ||
      control.name || (control.id.startsWith('city-')?'city':'');
    if (manual && !state.overrideFields.includes(manual)) state.overrideFields.push(manual);
    if (control.name==='days') state.unsupportedDays=null;
    if (control.name==='date') state.invalidDate=null;
    if (control.name==='size') state.invalidSize=null;
    setDirty();
    if (control.id==='city-query') {
      state.query=control.value;
      state.selectedCity=null;
      state.cities=[];
      cityOptions();
      clearTimeout(searchTimer);
      const version=++state.findVersion;
      if (state.query.trim().length<2) {showDefaults();return;}
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
      syncAdditionalCitiesControl();
    }
    state.settings=settingsFrom(find('#draft-input'));
    showDefaults();
    retainDraft();
  };
  const click = event=>{
    if (event.target.closest('[data-action=cancel-composer]') && pending) {
      const feedback=pending.feedback;
      pending.controller.abort();
      finish(pending);
      if (feedback) {
        feedback.querySelector('.composer-swap-status').textContent=t('Запрос отменён. Введённые параметры сохранены.');
        feedback.closest('details').querySelector('summary').focus();
      } else {
        showNote('Запрос отменён. Введённые параметры сохранены.');
        find('#draft-input [type=submit]').focus();
      }
      return;
    }
    const button=event.target.closest('[data-composer]');
    if (!button) return;
    const {composer:action,value}=button.dataset;
    if (action==='refine') {void analyse();return;}
    if (pending && (['example','remove-city','restore-stop','pin-stop','omit-stop'].includes(action) ||
        (pending.feedback && ['day','stop','weather-alternatives'].includes(action)))) {
      pending.controller.abort();
      finish(pending);
    }
    if (action==='example') {
      const input = find('[name=brief]');
      input.value=examples[Number(value)][1][{ru:0,en:1,zh:2}[getLocale()]];
      state.brief=input.value;
      state.unsupportedDays=null;
      state.invalidDate=null;
      state.invalidSize=null;
      state.overrideFields=[];
      setDirty();
      syncActions();
      retainDraft();
      input.focus();
      return;
    }
    if (action==='remove-city') {
      state.extraCities=state.extraCities.filter(city=>city.id!==value);
      if (!state.overrideFields.includes('city')) state.overrideFields.push('city');
      cityOptions();
      setDirty();
      showDefaults();
      retainDraft();
      (find('#draft-additional-cities button')??find('#draft-add-city summary')).focus();
      return;
    }
    if (action==='add-city') {
      const city=extraMatches.find(item=>item.id===value);
      if (!city || !state.selectedCity || pending || state.extraCities.length>=2 ||
          state.selectedCity.id===city.id || state.extraCities.some(item=>item.id===city.id)) return;
      state.extraCities.push(city);
      if (!state.overrideFields.includes('city')) state.overrideFields.push('city');
      const query=find('#extra-city-query');
      query.value='';
      searchAdditionalCity('');
      cityOptions();
      setDirty();
      showDefaults();
      retainDraft();
      (find('#draft-add-city').hidden?find('#draft-additional-cities li:last-child button'):query)?.focus();
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
    if (action==='service-more') {
      const previous=serviceView.limit;
      serviceView.limit+=8;
      paintServices();
      container.querySelectorAll('.composer-service-list li button')[previous]?.focus();
      return;
    }
    if (action==='service-clear') {
      find('#draft-service-query').value=serviceView.query='';
      find('#draft-service-kind').value=serviceView.kind='all';
      const cityField=find('#draft-service-city');
      if (cityField) cityField.value=serviceView.city='';
      serviceView.limit=8;
      paintServices();
      find('#draft-service-query').focus();
      return;
    }
    if (action==='service-include' || action==='service-release') {
      if (pending || state.dirty) return;
      const place=(action==='service-include'?state.result.places:state.requiredServices)
        .find(item=>item.id===value && ['stay','food'].includes(item.kind));
      if (!place) return;
      const services=state.requiredServices.filter(item=>item.id!==value);
      if (action==='service-include') services.push({id:place.id,name:place.name,en:place.en,cn:place.cn,kind:place.kind,city:place.city});
      const feedback=find('.composer-service-feedback');
      if (services.length>10) feedback.querySelector('.composer-swap-status').textContent=t('Можно выбрать до 10 обязательных объектов. Уберите лишние из списка.');
      else void build(find('#draft-input'),null,feedback,services,value);
      return;
    }
    if (action==='day') {
      state.mapDay=value;
      state.point=null;
      state.pointDay=null;
      paintDays(true);
      find('#draft-days [aria-pressed=true]')?.focus({preventScroll:true});
    }
    if (action==='fit') map?.fit({routeOnly:true});
    if (action==='stop' || action==='weather-alternatives') {
      if (action==='weather-alternatives' && state.dirty) {
        showNote('Параметры изменились. Соберите черновик заново.');
        find('#draft-input [type=submit]').focus();
        return;
      }
      state.point=value;
      state.pointDay=Number(button.dataset.day);
      paintDays();
      map?.select(value,{focus:true});
      const alternatives = action==='weather-alternatives' ? find('.composer-alternatives') : null;
      if (alternatives) {
        alternatives.open=true;
        alternatives.querySelector('summary')?.focus();
      } else find('#draft-timeline button[aria-pressed=true]')?.focus({preventScroll:true});
    }
    if (action==='export' && !state.dirty) download(state.result);
    if (action==='replace-stop') {
      const previousId=button.dataset.previous;
      const candidate=state.result.plan.days[state.pointDay]?.stops.find(stop=>stop.id===previousId)?.alternatives?.find(place=>place.id===value);
      if (!candidate || state.dirty) return;
      void build(find('#draft-input'),{day:state.pointDay,fromId:previousId,toId:value},button.closest('details').querySelector('.composer-swap-feedback'));
    }
    if (action==='pin-stop'||action==='omit-stop') {
      const place=state.result.places.find(item=>item.id===value);
      if (!place) return;
      const form=find('#draft-input');
      if (action==='pin-stop') {
        const input=form.elements.required;
        const fields=settingsFrom(form);
        const required=[...new Set([...fields.required,place.name])];
        if (required.length<=10) input.value=required.join(', ');
        else {
          find('#draft-advanced').open=true;
          find('#draft-parameters').open=true;
          showNote('Можно выбрать до 10 обязательных объектов. Уберите лишние из списка.');
          input.focus();
          return;
        }
        state.omitted=state.omitted.filter(item=>item.id!==place.id);
        find('#draft-advanced').open=true;
        find('#draft-parameters').open=true;
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
  showDefaults();
  syncActions();
  resultMarkup();
  return {destroy(){
    mounted=false;
    if (pending) {pending.controller.abort();finish(pending);}
    clearTimeout(searchTimer);
    clearTimeout(extraSearchTimer);
    map?.destroy();
    container.removeEventListener('submit',submit);
    container.removeEventListener('input',input);
    container.removeEventListener('click',click);
  }};
}
