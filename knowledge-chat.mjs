import { assess, clockTime, defaultRoute, months, officialStatistics, publishedHours, routeSettings } from './engine.mjs';

const localeTags = {ru:'ru-RU',en:'en-GB',zh:'zh-Hans'};
const copy = {
  context:['Уточните запрос','Refine your question','请补充问题'],
  examples:['Спросите о графике конкретного объекта, состоянии источников, изменениях маршрута или статистике размещения.','Ask about a specific place’s hours, data sources, route changes or accommodation statistics.','可以询问具体地点的开放时间、数据源、行程变化或住宿统计。'],
  name:['Укажите объект из каталога. Можно добавить город и дату визита.','Name a place from the catalogue. You can add the city and visit date.','请提供名录中的地点名称，也可以补充城市和到访日期。'],
  invalidDate:['Укажите действительную дату визита в формате ГГГГ-ММ-ДД.','Enter a valid visit date in YYYY-MM-DD format.','请使用 YYYY-MM-DD 格式输入有效日期。'],
  invalidGroup:['Для проверки условий укажите группу от 1 до 100 человек.','Enter a group size from 1 to 100 for the visit check.','请提供 1 至 100 人的团队人数以核查条件。'],
  catalogue:['Открыть каталог','Open the catalogue','打开名录'],
  map:['Открыть карту','Open the map','打开地图'],
  schedule:['Опубликованные часы','Published hours','公布的开放时间'],
  scheduleScope:['Область действия графика','Schedule applies to','开放时间适用范围'],
  noSchedule:['Опубликованный график в каталоге отсутствует. Сверьте часы с объектом.','The catalogue has no published schedule for this site. Check directly with the venue.','名录中暂无该地点公布的开放时间，请向场馆确认。'],
  outside:['Опубликованный график не покрывает эту дату.','The published schedule does not cover this date.','公布的开放时间未涵盖该日期。'],
  closed:['Закрыто по опубликованному графику.','Closed according to the published schedule.','按照公布的安排，该日期闭馆。'],
  visitDate:['Дата визита','Visit date','到访日期'],
  ready:['Условия группы покрывают выбранную дату. Подтвердите места у поставщика.','Recorded group-visit terms cover the selected date. Confirm availability with the venue.','已记录的团体接待条件涵盖所选日期，请向场馆确认名额。'],
  unknown:['Условия группового визита требуют подтверждения.','Group-visit terms need confirmation from the venue.','团体接待条件仍需向场馆确认。'],
  blocked:['На выбранную дату выявлено ограничение.','A constraint was found for the selected date.','所选日期存在限制。'],
  booking:['Условия записи','Booking terms','预约条件'],
  limits:['Опубликованное ограничение','Published constraint','公布的限制'],
  notes:['Сведения объекта','Venue information','场馆信息'],
  verify:['Что уточнить','What to confirm','待核实事项'],
  catalogueTitle:['Каталог Владимирской области','Vladimir Region catalogue','弗拉基米尔州名录'],
  location:['В каталоге доступны паспорта, источники и вопросы для сверки условий группового визита.','The catalogue provides place records, source links and questions to check before group visits.','名录提供地点档案、来源链接和团体到访前需确认的事项。'],
  emptyPlaces:['По этим условиям записи в каталоге не найдены.','No catalogue entries match those criteria.','名录中没有符合条件的记录。'],
  chooseCity:['Укажите один город для поиска объектов.','Specify one city for the place search.','请指定一个城市来查找地点。'],
  nationalCandidates:['Найдены точки в картографических источниках. Графики, вместимость, свободные места и условия записи нужно подтвердить у объектов.','Mapping sources supplied candidate locations. Confirm opening hours, group capacity, availability and booking requirements with each venue.','地图来源提供了候选地点。请向场馆确认开放时间、团队容量、剩余名额和预约要求。'],
  nationalNoMatches:['В доступной выборке на этот запрос нет совпадений. Проверьте название объекта и город.','The available sources returned no matching locations. Check the place name and city.','可用来源未返回匹配地点，请核对地点和城市名称。'],
  nationalNearby:['Близость к указанной точке требует отдельной проверки на карте.','Use the map to check proximity to the named location.','请在地图上核查地点与指定位置的距离。'],
  nationalUnavailable:['Получить сведения об объектах сейчас не удалось.','Place data is currently unavailable.','目前无法获取地点数据。'],
  nationalAvailability:['Условия группового визита на эту дату ещё нужно подтвердить.','Group availability on this date still needs confirmation.','所选日期的团体接待条件仍需确认。'],
  nationalSnapshot:['Сохранённая выборка','Saved snapshot','已保存的快照'],
  citySource:['Географическая запись города','City gazetteer entry','城市地理记录'],
  changes:['Журнал изменений','Change log','变更日志'],
  changeScope:['Последние записи из журнала. Учебные записи отмечены.','Latest log entries. Training entries are labelled.','以下是最新日志记录。演示记录已标注。'],
  emptyChanges:['В журнале нет записей по этому запросу.','The log has no entries for this request.','日志中没有符合该查询的记录。'],
  synthetic:['Учебные данные','Training data','演示数据'],
  changesLink:['Открыть журнал и источники','Open the log and sources','打开日志与来源'],
  impact:['Что изменилось в программах','What changed in programmes','行程发生了什么变化'],
  hasImpact:['Ниже наблюдаемые программы, которые требуют пересмотра.','The monitored programmes below require a review.','以下受监测的行程需要重新核查。'],
  noImpact:['По текущим данным пересмотр наблюдаемых программ по этому запросу не требуется.','Current data shows no monitored programmes requiring review for this request.','根据当前数据，没有符合该查询且需复查的受监测行程。'],
  source:['Открыть первоисточник','Open the primary source','打开原始来源'],
  sources:['Источники и актуальность','Sources and freshness','数据来源与时效'],
  sourcesScope:['Состояние подключений по последней проверке. Дата в ссылках относится к данным, если они получены.','Connection status at the last check. Source dates refer to the data when available.','以下是最近一次检查的连接状态。来源日期为可用数据的日期。'],
  live:['Данные получены','Data retrieved','数据已获取'],
  error:['Используется последняя копия','Using the last available copy','正在使用最近可用的副本'],
  snapshot:['Начальный снимок','Initial snapshot','初始快照'],
  recommendations:['Приоритеты проверки','Review priorities','核查重点'],
  recommendationScope:['Рекомендации сформированы из доступных данных. Ограничения и причинные гипотезы сверяет специалист.','These priorities are derived from available data. An analyst verifies constraints and causal hypotheses.','以下建议依据可用数据生成。限制条件及因果假设由分析人员核实。'],
  route:['Собрать программу','Build an itinerary','编制行程'],
  routeScope:['В маршрутах можно задать направление, даты и требования группы. Предложенные остановки проверяются по доступным условиям.','In the route workspace, set a destination, dates and group requirements. Proposed stops are checked against available evidence.','在行程工作区可设置目的地、日期及团队要求。系统根据可用资料核查候选地点。'],
  chart:['Открыть статистику','Open the statistics','打开统计'],
  statistics:['Статистика размещения','Accommodation statistics','住宿统计'],
  people:['Численность размещённых лиц','Guests staying in accommodation','住宿接待人数'],
  nights:['Число ночёвок','Overnight stays','住宿夜数'],
  statisticsScope:['Охват — средства размещения Владимирской области.','Coverage is accommodation establishments in Vladimir Region.','统计范围为弗拉基米尔州住宿机构。'],
  regionalStatisticsScope:['Охват — средства размещения указанного субъекта.','Coverage is accommodation establishments in the selected federal subject.','统计范围为所选联邦主体的住宿机构。'],
  regionalStatisticsUnavailable:['Подключённый источник не вернул сопоставимый ряд для выбранного субъекта.','The connected source returned no comparable series for the selected federal subject.','已连接的数据源未返回该联邦主体可比较的序列。'],
  regionalStatisticsMethodology:['С отчёта за январь 2026 года применяется обновлённая методология Росстата. Учитывайте её при сравнении с предыдущими годами.','Rosstat updated the methodology from the January 2026 reporting period. Account for it when comparing with previous years.','俄罗斯统计局自2026年1月起采用更新后的统计方法。与往年比较时请考虑这一变化。'],
  cityStatisticsUnavailable:['Для статистики отдельного города нужен муниципальный ряд. В этом сервисе можно выбрать данные по субъекту.','City-level figures require a municipal series. This service provides data by federal subject.','单个城市的统计需要市级数据。本服务可按联邦主体查看数据。'],
  unavailableMetric:['Для этого показателя нужен отдельный ряд данных. Сейчас доступны ночёвки и размещённые лица по Владимирской области.','This metric needs a separate dataset. The connected series cover overnight stays and accommodated guests in Vladimir Region.','该指标需要单独的数据集。目前可查弗拉基米尔州住宿夜数及住宿接待人数。'],
  unavailableArea:['Подключённые ряды охватывают Владимирскую область целиком. Данных для отдельных городов и других регионов в них нет.','The connected series cover Vladimir Region as a whole. They do not provide figures for individual cities or other regions.','已连接的数据覆盖整个弗拉基米尔州，不提供其他地区或单个城市的数据。'],
  noStats:['Доступных значений за указанный период нет.','No values are available for the requested period.','指定期间暂无可用数据。'],
  missingYears:['Нет данных за годы','Unavailable years','缺少数据的年份'],
  partial:['Неполные годовые ряды','Incomplete annual series','不完整年度序列'],
  lowest:['Месяцы с наименьшими средними значениями','Months with the lowest averages','平均值最低的月份'],
  highest:['Месяцы с наибольшими средними значениями','Months with the highest averages','平均值最高的月份'],
  yearly:['Итоги за полные годы','Totals for complete years','完整年度总计'],
  unitNights:['ночёвок','overnight stays','住宿夜'],
  unitPeople:['чел.','guests','人'],
};

const venueAliases = {
  'suzdal-kremlin':['суздальского кремля','суздальском кремле','кремль в суздале','suzdal kremlin'],
  'golden-gate':['золотые ворота','золотых ворот','golden gate','金门'],
  'dmitrovsky':['дмитриевского собора','дмитриевском соборе','dmitrievsky cathedral','dmitriev cathedral'],
  assumption:['успенского собора','успенском соборе','assumption cathedral','dormition cathedral'],
  palaty:['музей палаты','палаты','palaty museum','museum chambers'],
  history:['исторического музея во владимире','vladimir history museum'],
  euthymius:['спасо евфимиев монастырь','спасо евфимиева монастыря','st euthymius monastery'],
  wood:['музея деревянного зодчества','museum of wooden architecture'],
  'vladimir-glass':['музея хрусталя и стекла','vladimir crystal museum','vladimir glass museum'],
  'maltsov-crystal':['музея хрусталя имени мальцовых','музей мальцовых','мальцовский музей','maltsov museum'],
  'gus-history':['исторического музея в гусь хрустальном','историко художественного музея гусь хрустального'],
  'murom-exhibit':['выставочный центр в муроме','муромский выставочный центр','выставочного центра муромского музея'],
  'murom-gallery':['галерея в муроме','галерею в муроме','муромская галерея','murom art gallery'],
  'murom-monastery':['муромский монастырь','спасо преображенского монастыря','murom monastery'],
  'nerl-trail':['тропа к храму покрова на нерли','храм покрова на нерли','церковь покрова на нерли','боголюбовский луг','church on the nerl','nerl trail','内尔利河圣母帡幪教堂'],
};

const locations = {
  Владимир:['владимир','владимире','владимира','vladimir','弗拉基米尔市'],
  Суздаль:['суздаль','суздале','суздаля','suzdal','苏兹达尔'],
  Кидекша:['кидекша','кидекше','кидекши','kideksha','基杰克沙'],
  Муром:['муром','муроме','мурома','murom','穆罗姆'],
  'Гусь-Хрустальный':['гусь хрустальный','гусь хрустальном','гусь хрустального','gus khrustalny','古斯赫鲁斯塔利内'],
  Боголюбово:['боголюбово','bogolyubovo','博戈柳博沃'],
  Александров:['александров','александрове','александрова','alexandrov','亚历山德罗夫'],
};

const changeTerms = /измен|поменя|обнов|change|update|变更|变化|更新/u;
const routeTerms = /маршрут|поездк|программ|route|itinerar|programme|行程|路线/u;
const scheduleTerms = /график|работа[ею]|откры|закры|час[ыо]|запис|брон|сеанс|лимит|вместим|доступ|свободн.*номер|справк|hours|schedule|open|clos|book|capacity|availab|开放|闭馆|预约|名额|容量|时间表|可接待/u;
const metricTerms = /ночев|сезонност|размещен|загрузк|турпоток|статистик|спрос|сколько турист|overnight|accommodat|occupancy|seasonality|statistic|visitor flow|how many tourists|住宿|过夜|客流|入住率|季节性|统计|多少游客/u;

const normalize = text => text.toLowerCase().normalize('NFKC').replaceAll('ё','е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const contains = (query,text) => /^[\p{sc=Han}]+$/u.test(text) ? query.includes(text) : (' '+query+' ').includes(' '+text+' ');
const placeName = (place,locale) => (locale==='en' ? place.en : locale==='zh' ? place.cn : null) ?? place.name;

function namedPlaces(places, query) {
  const result = places.flatMap(place=>{
    const aliases = [place.name,place.en,place.cn,...venueAliases[place.id] ?? []].filter(Boolean).map(normalize);
    const exact = aliases.filter(alias=>contains(query,alias));
    return exact.length ? [{place,length:Math.max(...exact.map(alias=>alias.length))}] : [];
  });
  return result.sort((a,b)=>b.length-a.length).map(({place})=>place);
}

function detectIntent(query, hasPlace) {
  if (/занят.*маршрут|затрон|повлия|пересмотр|affect|impact|受影响|需要复查/u.test(query) && (routeTerms.test(query) || hasPlace)) return 'impact';
  if (/статус источ|когда.*провер.*источ|проверен.*источ|источ.*провер|source.*status|source.*fresh|来源.*状态/u.test(query)) return 'sources';
  if (routeTerms.test(query) && changeTerms.test(query)) return 'impact';
  if (changeTerms.test(query) && (!scheduleTerms.test(query) || hasPlace)) return 'changes';
  if (scheduleTerms.test(query) && (hasPlace || !metricTerms.test(query))) return 'schedule';
  if (metricTerms.test(query)) return 'statistics';
  if (/источник|откуда данные|актуаль|сверк|source|freshness|where.*from|来源|数据源|时效/u.test(query)) return hasPlace ? 'schedule' : 'sources';
  if (/рекоменд|следующ.*действ|приоритет|улучш|recommend|priority|priorities|improve|建议|优先|改进/u.test(query)) return 'recommendations';
  if (routeTerms.test(query)) return 'route';
  if (hasPlace || /каталог|паспорт|какие объекты|музе[ий]|отел|парк|ресторан|достопримечательност|catalogue|catalog|venue|museum|hotel|attraction|park|restaurant|名录|场馆|博物馆|酒店|公园|景点|餐厅/u.test(query)) return 'places';
  return null;
}

function prepareResponse(locale,intent,title,text,actions = [], extras = {}) {
  return {status:'answered',locale,intent,title,text,items:[],sources:[],actions,mode:'deterministic',...extras};
}

function reference(title,url,checkedAt) {
  if (typeof url !== 'string') return null;
  if (!/^\/api\/audit-version\/[12]$/.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol!=='https:' || parsed.username || parsed.password) return null;
    } catch { return null; }
  }
  return {title,url,checkedAt:checkedAt ?? null};
}

function references(items) {
  const unique = new Map();
  for (const item of items.filter(Boolean)) if (!unique.has(item.url)) unique.set(item.url,item);
  return [...unique.values()];
}

const actions = (t,...pairs) => pairs.map(([label,href])=>({title:t(label),href}));
const mapPlace = id => '#impact?place='+encodeURIComponent(id);
const mapProgram = id => '#impact?program='+encodeURIComponent(id);
const formatDate = (tag,date) => new Intl.DateTimeFormat(tag,{dateStyle:'medium',timeZone:'Europe/Moscow'}).format(new Date(date));
const validDate = value => /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const monthsGenitive = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const monthsEnglish = ['january','february','march','april','may','june','july','august','september','october','november','december'];

function visitDate(question, fallback, now) {
  const pack = (year,month,day) => `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const iso = question.match(/\b20\d{2}-\d{1,2}-\d{1,2}\b/u)?.[0];
  if (iso) return pack(...iso.split('-'));
  const dotted = question.match(/\b(\d{1,2})[.\/](\d{1,2})[.\/](20\d{2})\b/u);
  if (dotted) return pack(dotted[3],dotted[2],dotted[1]);
  const han = question.match(/(?:(20\d{2})年\s*)?(\d{1,2})月\s*(\d{1,2})[日号]/u);
  if (han) return pack(han[1] ?? fallback.slice(0,4),han[2],han[3]);
  const text = question.toLowerCase();
  const word = [...text.matchAll(/(?:^|[^\p{L}\p{N}])(\d{1,2})\s+([\p{L}]+)(?:\s+(20\d{2}))?/gu)]
    .find(([,day,month])=>monthsGenitive.includes(month) || monthsEnglish.includes(month));
  if (word) return pack(word[3] ?? fallback.slice(0,4),Math.max(monthsGenitive.indexOf(word[2]),monthsEnglish.indexOf(word[2]))+1,word[1]);
  const monthFirst = [...text.matchAll(/\b([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?/g)]
    .find(([,month])=>monthsEnglish.includes(month));
  if (monthFirst) {
    return pack(monthFirst[3] ?? fallback.slice(0,4),monthsEnglish.indexOf(monthFirst[1])+1,monthFirst[2]);
  }
  const relative = /послезавтра|day after tomorrow|后天/u.test(text) ? 2 :
    /завтра|tomorrow|明天/u.test(text) ? 1 : /сегодня|\btoday\b|今天/u.test(text) ? 0 : null;
  if (relative!==null) {
    const local = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Europe/Moscow'})
      .formatToParts(now).map(({type,value})=>[type,value]));
    const day = new Date(pack(local.year,local.month,local.day)+'T12:00:00Z');
    day.setUTCDate(day.getUTCDate()+relative);
    return day.toISOString().slice(0,10);
  }
  return fallback;
}

function placeAnswer(place,date,settings,locale,t) {
  const name = placeName(place,locale);
  const hours = publishedHours(place,date);
  const assessment = assess(place,{...settings,date,demo:false});
  const published = place.publishedConditions ?? {};
  const info = hours?.windows?.map(([start,end])=>clockTime(start)+'–'+clockTime(end)).join(', ');
  const hoursText = !hours ? t('noSchedule') : !hours.windows ? t('outside') : info || t('closed');
  const items = [{title:t('schedule'),text:hoursText}];
  if (hours?.label || hours?.note) items.push({title:t('scheduleScope'),text:[hours.label,hours.note].filter(Boolean).join('. '),lang:'ru'});
  for (const [label,entries] of [['booking',[published.booking]],['limits',published.limits ?? []],['notes',published.notes ?? []]]) {
    items.push(...entries.filter(Boolean).map(entry=>({title:t(label),text:entry.text,lang:'ru'})));
  }
  const questions = [...new Set([...(published.clarify ?? []),...assessment.reasons])];
  if (questions.length) items.push({title:t('verify'),text:questions.join(' '),lang:'ru'});
  const sources = references([
    reference(t('schedule'),hours?.url,published.checkedAt),
    reference(t('booking'),published.booking?.url,published.checkedAt),
    ...[...published.limits ?? [],...published.notes ?? []].map(entry=>reference(t('notes'),entry.url,published.checkedAt)),
    reference(t('source'),place.verifiedAudit?.sourceUrl,place.verifiedAudit?.verifiedAt),
    reference(name,place.url,place.checkedAt),
  ]);
  return prepareResponse(locale,'schedule',name,
    t('visitDate')+' · '+formatDate(localeTags[locale],date)+'. '+t(assessment.status),
    actions(t,['map',mapPlace(place.id)],['catalogue','#catalog']),{items,sources});
}

function catalogueAnswer(data,query,matched,locale,t) {
  const city = Object.entries(locations).find(([,aliases])=>aliases.some(alias=>contains(query,alias)))?.[0];
  const museum = /музе[ий]|museum|博物馆/u.test(query);
  const kind = /отел|гостиниц|hotel|酒店/u.test(query) ? 'stay' : /ресторан|питани|restaurant|餐厅/u.test(query) ? 'food' : null;
  const places = matched.length ? matched : data.places.filter(place=>(!city || place.city===city) &&
    (!kind || place.kind===kind) && (!museum || place.theme==='museum'));
  const top = places.slice(0,5);
  return prepareResponse(locale,'places',t('catalogueTitle'),t(places.length ? 'location' : 'emptyPlaces'),actions(t,['catalogue','#catalog']),{
    items:top.map(place=>({title:placeName(place,locale),text:place.city,href:mapPlace(place.id)})),
    sources:references(top.map(place=>reference(placeName(place,locale),place.url,place.publishedConditions?.checkedAt ?? place.checkedAt))),
  });
}

function groupSize(query, fallback) {
  const size = query.match(/(?:групп[а-я]* из|group of)\s+(\d+)|(?:^|\s)(\d+)\s*(?:человек|гост[ея]|people|guests)|(\d+)\s*人/u);
  return size ? Number(size[1] ?? size[2] ?? size[3]) : fallback;
}

const nearbyTerms = /рядом|около|возле|nearby|near\b|around|附近|周边/u;

function nationwideCandidates(places,query) {
  const exact = namedPlaces(places,query);
  if (exact.length) return exact;
  const listing = /какие|перечень|список|подбер|покаж|посовет|есть ли|музеи|отели|парки|достопримечательности|which|list|find|what|recommend|museums|hotels|parks|places|哪些|推荐|有没有/u.test(query);
  if (!listing) return [];
  if (/отел|гостиниц|номер|hotel|guest room|住宿|酒店/u.test(query)) return places.filter(place=>place.kind==='stay');
  if (/ресторан|кафе|restaurant|cafe|餐厅|咖啡馆/u.test(query)) return places.filter(place=>place.kind==='food');
  if (/музе|галере|museum|gallery|博物馆|美术馆/u.test(query)) return places.filter(place=>place.tags?.includes('museum'));
  if (/парк|зелен|park|garden|公园|花园/u.test(query)) return places.filter(place=>place.tags?.includes('nature'));
  return places.filter(place=>place.kind==='visit');
}

async function nationwidePlaceAnswer(city,question,query,parameters,lookupDraft,locale,t,now,intent) {
  const title = placeName(city,locale);
  const next = actions(t,['route','#route']);
  const date = visitDate(question,parameters.date,now);
  const size = groupSize(query,parameters.size);
  if (!validDate(date) || !Number.isInteger(size) || size<1 || size>100) {
    return prepareResponse(locale,intent,title,t(!validDate(date) ? 'invalidDate' : 'invalidGroup'),next,{status:'needs-context'});
  }
  const citySource = reference(t('citySource'),city.sourceUrl,null);
  if (nearbyTerms.test(query)) return prepareResponse(locale,intent,title,t('nationalNearby'),next,{status:'needs-context',sources:references([citySource])});
  let result;
  try {
    result = await lookupDraft({...parameters,cityId:city.id,date,size,demo:false});
  } catch {
    return prepareResponse(locale,intent,title,t('nationalUnavailable'),next,{status:'unavailable',sources:references([citySource])});
  }
  const venues = (result?.places ?? []).filter(place=>place.city===city.name && reference(place.name,place.url));
  const matches = nationwideCandidates(venues,query).slice(0,5);
  const provider = result?.sources?.find(entry=>String(entry.cityId)===String(city.id)) ?? result?.source;
  const providerSources = [provider,provider?.supplemental].filter(Boolean).map(entry=>reference(
    (entry.status==='snapshot' ? t('nationalSnapshot')+' · ' : '')+entry.name,entry.url,entry.checkedAt));
  const sources = references([...providerSources,...matches.map(place=>reference(placeName(place,locale),place.officialUrl,null)),citySource]);
  const items = matches.map(place=>({title:placeName(place,locale),text:intent==='schedule' ? t('nationalAvailability') : title,href:place.url}));
  const summary = items.length ? t('nationalCandidates') : t(venues.length ? 'nationalNoMatches' : 'nationalUnavailable');
  const context = intent==='schedule' ? t('visitDate')+' · '+formatDate(localeTags[locale],date)+'. ' : '';
  return prepareResponse(locale,intent,title,context+summary,next,{status:items.length && intent!=='schedule' ? 'answered' : 'unavailable',items,sources});
}

function changeAnswer(data,query,matched,t,locale,impact) {
  const ids = matched.map(place=>place.id);
  const liveOnly = /без учеб|реальн|внешн|actual only|real only|live only|仅真实/u.test(query);
  const changes = data.changes.filter(item=>(!liveOnly || !item.demo) && (!ids.length || ids.includes(item.id))).slice(0,5);
  const sources = references(changes.map(item=>reference(item.source,item.url,item.at)));
  if (!impact) {
    const value = item=>item === null || item===undefined ? '—' : Array.isArray(item) ? item.join(', ') : String(item);
    const items = changes.map(item=>({title:item.name,text:item.field+' · '+value(item.before)+' → '+value(item.after),
      ...(item.id ? {href:mapPlace(item.id)} : {}),...(item.demo ? {status:t('synthetic')} : {}),lang:'ru'}));
    return prepareResponse(locale,'changes',t('changes'),t(items.length ? 'changeScope' : 'emptyChanges'),actions(t,['changesLink','#sources']),{items,sources});
  }
  const chineseGroup = /кита|chinese|中国/u.test(query);
  const programmes = data.affected.filter(program=>program.affected && (!liveOnly || !program.settings.demo) &&
    (!chineseGroup || program.settings.market==='zh') && (!ids.length || program.issues.some(issue=>ids.includes(issue.id))));
  const items = programmes.slice(0,5).map(program=>({title:program.title+' · '+program.subtitle,
    text:program.issues.map(issue=>issue.name+'. '+issue.reasons.join(' ')).join(' '),href:mapProgram(program.id),
    ...(program.settings.demo ? {status:t('synthetic')} : {}),lang:'ru'}));
  for (const program of programmes) {
    if (program.settings.demo) sources.push(reference(t('synthetic'),'/api/audit-version/'+data.auditVersion,data.auditCheckedAt));
    else for (const issue of program.issues) {
      const place = data.places.find(item=>item.id===issue.id);
      sources.push(reference(issue.name,place?.verifiedAudit?.sourceUrl ?? place?.publishedConditions?.schedule?.url ?? place?.url,
        place?.verifiedAudit?.verifiedAt ?? place?.publishedConditions?.checkedAt));
    }
  }
  return prepareResponse(locale,'impact',t('impact'),t(items.length ? 'hasImpact' : 'noImpact'),
    actions(t,['map',items[0]?.href ?? '#impact']),{items,sources:references(sources)});
}

function sourceAnswer(data,locale,t) {
  const entries = [
    ['nights',t('nights'),data.nights?.source,data.nights?.checkedAt],
    ['people',t('people'),data.people?.source,data.people?.checkedAt],
    ['wiki','Wikidata','https://www.wikidata.org/wiki/Wikidata:Data_access',data.sources.wiki?.status==='live' ? data.sources.wiki.checkedAt : null],
  ];
  const items = entries.map(([key,title])=>{
    const status = data.sources[key];
    return {title,text:t(status?.status==='live' ? 'live' : status?.status==='error' ? 'error' : 'snapshot'),checkedAt:status?.checkedAt ?? null};
  });
  return prepareResponse(locale,'sources',t('sources'),t('sourcesScope'),actions(t,['changesLink','#sources']),{
    items,sources:references(entries.map(([,title,url,checkedAt])=>reference(title,url,checkedAt))),
  });
}

function statisticsRequest(question,query) {
  const years = [...new Set((query.match(/\b20\d{2}\b/g) ?? []).map(Number))].sort((a,b)=>a-b);
  const range = question.match(/(20\d{2})\s*(?:[–—-]|по|to|至)\s*(20\d{2})/iu);
  const duration = range ? Number(range[2])-Number(range[1])+1 : 0;
  const words = {one:1,two:2,three:3,four:4,five:5,один:1,два:2,три:3,четыре:4,пять:5,一:1,两:2,二:2,三:3,四:4,五:5};
  const relative = query.match(/(?:последн[а-я]*|last|past)\s+([\p{L}\p{N}]+)\s*(?:год|лет|year)/u) ?? query.match(/(?:过去|近)\s*([1-5一两二三四五])\s*年/u);
  const last = relative ? Math.max(1,Math.min(Number(relative[1]) || words[relative[1]] || 3,5)) : 3;
  const metric = /ночев|overnight|过夜|住宿夜/.test(query) ? 'nights' : /размещен.*лиц|размещени[ея] турист|гост[еия]|человек|выбр.*размещен|guests|people|住宿接待人数|入住人数/u.test(query) ? 'people' : 'nights';
  return {intent:'statistics',metric,years:duration>=1 && duration<=15 ? Array.from({length:duration},(_,i)=>Number(range[1])+i) : years,last,mode:'Базовый разбор'};
}

function cityStatistics(query) {
  return /(?:^|\s)(?:в|по|для)\s+(?:суздал[а-я]*|владимире|владимиру|муром[а-я]*|гусь хрустальн[а-я]*|боголюбов[а-я]*|москв[а-я]*|петербург[а-я]*|казан[а-я]*|сочи|город[еу])(?:\s|$)/u.test(query) ||
    /(?:in|for) (?:suzdal|murom|moscow|kazan|sochi|saint petersburg|st petersburg|vladimir city)(?:\s|$)|\bin vladimir\s*$|苏兹达尔|穆罗姆|莫斯科|喀山|索契|弗拉基米尔市/u.test(query);
}

function namesOtherSubject(query,area) {
  const oblast = [...query.matchAll(/(?:^|\s)([а-я]{4,})\s+(?:област[ьи]|кра[йеяю])(?=\s|$)/gu)].map(([,name])=>name.slice(0,-2));
  const republic = [...query.matchAll(/(?:^|\s)республик[аеуи]\s+([а-я]{4,})(?=\s|$)/gu)].map(([,name])=>name.slice(0,-1));
  const label = normalize(area.name);
  return [...oblast,...republic].some(name=>!label.includes(name));
}

function requestedMonth(query) {
  const textual = months.findIndex((month,index)=>[month,monthsGenitive[index],monthsEnglish[index]].some(name=>contains(query,name)));
  if (textual>=0) return textual;
  const han = query.match(/(?:^|\D)(1[0-2]|[1-9])月/u);
  return han ? Number(han[1])-1 : -1;
}

async function statisticsAnswer(data,question,query,settings,scope,askStats,locale,t,now,getRegionalStats) {
  const chart = actions(t,['chart','#stats']);
  const vladimirScope = ['83','vladimir','vladimir-oblast','Vladimir Region','Владимирская область'].includes(String(scope));
  const regional = getRegionalStats && !vladimirScope && /^\d+$/u.test(String(scope));
  const otherScope = !regional && scope && !vladimirScope && !/владимирск|vladimir region|vladimir oblast|弗拉基米尔州/u.test(query);
  if (getRegionalStats && cityStatistics(query)) {
    return prepareResponse(locale,'statistics',t('statistics'),t('cityStatisticsUnavailable'),chart,{status:'unavailable'});
  }
  if (otherScope || cityStatistics(query) || (!regional && namesOtherSubject(query,{name:'Владимирская область'})) ||
      /по всей росси|по россии в целом|по всей стране|for all russia|across russia|全俄|俄罗斯全国/u.test(query)) {
    return prepareResponse(locale,'statistics',t('statistics'),t('unavailableArea'),chart,{status:'unavailable'});
  }
  if (/загрузк|заполняемост|occupancy|入住率|(?:турпоток|сколько турист|visitor flow|how many tourists|客流|多少游客)(?!.*(?:ночев|размещен|overnight|guests|住宿))/u.test(query)) {
    return prepareResponse(locale,'statistics',t('statistics'),t('unavailableMetric'),chart,{status:'unavailable'});
  }
  const request = statisticsRequest(question,query);
  if (!request.years.length && /в этом году|this year|今年/u.test(query)) request.years = [Number(now.toISOString().slice(0,4))];
  let result;
  try { result = regional ? await getRegionalStats({...request,regionId:scope}) : await askStats?.(question,settings,request); }
  catch { result = null; }
  if (regional && result?.region && namesOtherSubject(query,result.region)) {
    return prepareResponse(locale,'statistics',t('statistics'),t('regionalStatisticsUnavailable'),chart,{status:'unavailable'});
  }
  const initial = regional ? null : data[request.metric];
  const available = result?.summary ?? initial;
  const years = available?.years?.filter(year=>!request.years.length || request.years.includes(year.year)) ?? [];
  const tag = localeTags[locale];
  const output = new Intl.NumberFormat(tag);
  const unit = t(request.metric==='people' ? 'unitPeople' : 'unitNights');
  const monthName = index=>new Intl.DateTimeFormat(tag,{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2024,index,1)));
  const month = requestedMonth(query);
  const values = month<0 ? [] : years.flatMap(year=>Number.isFinite(year.monthly?.[month]) ?
    [{title:String(year.year)+' · '+monthName(month),text:output.format(year.monthly[month])+' '+unit}] : []);
  const full = years.filter(year=>Number.isFinite(year.total));
  const missing = request.years.filter(year=>!years.some(entry=>entry.year===year));
  const partial = years.filter(year=>!Number.isFinite(year.total)).map(item=>item.year);
  const annualQuestion = /динамик|сравни|за год|итог|всего|trend|compare|annual|total|对比|全年|总量|趋势/u.test(query) ||
    (request.years.length>0 && /сколько|how many|多少/u.test(query));
  const annual = month<0 && annualQuestion &&
    !/сезон|миним|максим|наимен|меньше|больше|средн|lowest|highest|fewest|most|season|平均|最高|最低/.test(query);
  if (annual) values.push(...full.map(year=>({title:String(year.year),text:output.format(year.total)+' '+unit})));
  const highest = /наибольш|максим|больше всего|highest|greatest|most|最多|最高/u.test(query);
  const comparison = full.length ? full : years;
  if (month<0 && !annual && comparison.length) {
    const comparable = months.flatMap((_,index)=>{
      const values = comparison.map(year=>year.monthly?.[index]);
      return values.every(Number.isFinite) ? [{index,value:Math.round(values.reduce((sum,value)=>sum+value,0)/values.length)}] : [];
    });
    comparable.sort((a,b)=>highest ? b.value-a.value : a.value-b.value);
    values.push(...comparable.slice(0,3).map(({index,value})=>({title:monthName(index),text:output.format(value)+' '+unit})));
  }
  const measure = month>=0 ? null : annual ? t('yearly') : t(highest ? 'highest' : 'lowest');
  const title = [result?.region && placeName(result.region,locale),t(request.metric),measure].filter(Boolean).join(' · ');
  const coverage = comparison.map(year=>year.year).join(', ');
  const notes = [t(regional ? 'regionalStatisticsScope' : 'statisticsScope')];
  if (!values.length) notes.push(t(regional && !available ? 'regionalStatisticsUnavailable' : 'noStats'));
  else if (month<0 && coverage) notes.push(coverage+'.');
  if (missing.length) notes.push(t('missingYears')+' · '+missing.join(', ')+'.');
  if (partial.length) notes.push(t('partial')+' · '+partial.join(', ')+'.');
  if (available?.methodologyChange) notes.push(t('regionalStatisticsMethodology'));
  if (available && (result?.sourceStatus ?? data.sources[request.metric]?.status)==='error') notes.push(t('error')+'.');
  const sources = references([
    ...(result?.sources ?? []).map(item=>reference(item.title,item.url,item.checkedAt)),
    reference('Roschart',available?.source,available?.checkedAt),
    reference('Росстат / Rosstat',available?.publication ?? officialStatistics,available?.checkedAt),
  ]);
  return prepareResponse(locale,'statistics',title,notes.join(' '),chart,{status:values.length ? 'answered' : 'unavailable',items:values,sources});
}

const supportedIntents = new Set(['statistics','sources','schedule','changes','impact','places','recommendations','route']);

export async function classifyKnowledge(question,{model,baseUrl,signal,fetchImpl=fetch}) {
  const labels = [...supportedIntents,'unknown'];
  const timeout=AbortSignal.timeout(36000);
  try {
    const response = await fetchImpl(new URL('/api/chat',baseUrl),{
      method:'POST',headers:{'Content-Type':'application/json'},signal:signal ? AbortSignal.any([signal,timeout]) : timeout,
      body:JSON.stringify({model,stream:false,think:false,keep_alive:'15m',
        options:{temperature:0,num_ctx:2048,num_predict:20},
        format:{type:'object',additionalProperties:false,required:['intent'],properties:{intent:{type:'string',enum:labels}}},
        messages:[
          {role:'system',content:'Classify a tourism analyst’s question. Reply with one JSON intent. statistics: quantitative data; sources: provenance or freshness; schedule: hours or booking; changes: event log; impact: monitored route affected; places: catalogue; recommendations: review priorities; route: building a programme; unknown: otherwise. Do not answer the question.'},
          {role:'user',content:question.slice(0,600)},
        ],
      }),
    });
    if (!response.ok) return null;
    const {message} = await response.json();
    const {intent} = JSON.parse(message.content);
    return supportedIntents.has(intent) ? intent : null;
  } catch { return null; }
}

export async function answerKnowledge({question,locale='ru',dashboard,settings,scope,now=new Date()},
  {askStats,classify,detectCities,lookupDraft,getRegionalStats}={}) {
  locale = locale==='zh-Hans' ? 'zh' : Object.hasOwn(localeTags,locale) ? locale : 'ru';
  const t = key=>copy[key][Object.keys(localeTags).indexOf(locale)];
  const query = normalize(typeof question==='string' ? question.slice(0,600) : '');
  const data = {places:[],changes:[],affected:[],sources:{},recommendations:[],...dashboard};
  const matched = namedPlaces(data.places,query);
  const parameters = routeSettings(settings ?? defaultRoute);
  let intent = detectIntent(query,matched.length>0);
  let mode = 'deterministic';
  if (!intent && query && classify) {
    try {
      const label = await classify(question.slice(0,600));
      if (supportedIntents.has(label)) { intent = label; mode = 'classified'; }
    } catch { /* The existing catalogue is usable without classification. */ }
  }
  let result;
  const cityScoped = ['statistics','schedule','places'].includes(intent);
  const cities = cityScoped && detectCities ? await Promise.resolve().then(()=>detectCities(question.slice(0,600))).catch(()=>[]) : [];
  const outsidePilot = cities.filter(city=>!Object.hasOwn(locations,city.name));
  if (intent==='statistics' && outsidePilot.length) {
    result = prepareResponse(locale,intent,t('statistics'),t(getRegionalStats ? 'cityStatisticsUnavailable' : 'unavailableArea'),
      actions(t,['chart','#stats']),{status:'unavailable'});
  } else if (outsidePilot.length) {
    if (!lookupDraft) result = prepareResponse(locale,intent,t('catalogueTitle'),t('nationalUnavailable'),[],{status:'unavailable'});
    else if (cities.length===1) result = await nationwidePlaceAnswer(cities[0],question,query,parameters,lookupDraft,locale,t,now,intent);
    else result = prepareResponse(locale,intent,t('context'),t('chooseCity'),actions(t,['route','#route']),{status:'needs-context'});
  } else if (intent==='statistics') result = await statisticsAnswer(data,question,query,parameters,scope,askStats,locale,t,now,getRegionalStats);
  else if (intent==='schedule' || (intent==='places' && matched.length===1)) {
    const date = visitDate(question,parameters.date,now);
    if (!validDate(date) || !matched.length) result = prepareResponse(locale,'schedule',t('context'),t(!matched.length ? 'name' : 'invalidDate'),
      actions(t,['catalogue','#catalog']),{status:'needs-context'});
    else if (matched.length>1) result = catalogueAnswer(data,query,matched,locale,t);
    else {
      const count = groupSize(query,parameters.size);
      if (!Number.isInteger(count) || count<1 || count>100) result = prepareResponse(locale,'schedule',t('context'),t('invalidGroup'),[],{status:'needs-context'});
      else result = placeAnswer(matched[0],date,{...parameters,size:count},locale,t);
    }
  } else if (intent==='places') result = catalogueAnswer(data,query,matched,locale,t);
  else if (intent==='changes' || intent==='impact') result = changeAnswer(data,query,matched,t,locale,intent==='impact');
  else if (intent==='sources') result = sourceAnswer(data,locale,t);
  else if (intent==='recommendations') {
    const items = data.recommendations.slice(0,5).map(({title,text})=>({title,text,lang:'ru'}));
    const sources = references(data.recommendations.slice(0,5).flatMap(item=>(item.sources ?? []).map(source=>reference(source.title,source.url,
      source.checkedAt ?? (source.url===data.nights?.source ? data.nights.checkedAt : null)))));
    result = prepareResponse(locale,intent,t('recommendations'),t('recommendationScope'),actions(t,['map','#impact']),{items,sources});
  } else if (intent==='route') result = prepareResponse(locale,intent,t('route'),t('routeScope'),actions(t,['route','#route']));
  else result = prepareResponse(locale,'clarify',t('context'),t('examples'),[],{status:'needs-context'});
  return {...result,mode};
}
