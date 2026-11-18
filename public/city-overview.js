import { addLocaleMessages, formatDate, formatNumber, getLocale, t } from '/locale.js';
import { createRouteMap } from '/map.js';
import { weatherSummary } from '/weather.js';
import { statSummary } from '/engine.mjs';
import { sourceEnabled } from '/source-preferences.js';

addLocaleMessages([
  ['Выберите город, чтобы посмотреть объекты, погоду и данные о размещении.','Choose a city to see places, weather and accommodation figures.','选择城市，查看地点、天气与住宿数据。'],
  ['Найти город России','Find a city in Russia','查找俄罗斯城市'],
  ['Введите название города','Enter a city name','输入城市名称'],
  ['Ищем города…','Finding cities…','正在查找城市…'],
  ['Города по этому запросу не найдены.','No cities match your search.','未找到符合搜索条件的城市。'],
  ['Поиск городов сейчас недоступен.','City search is currently unavailable.','目前无法查找城市。'],
  ['Загружаем данные города…','Loading city data…','正在加载城市数据…'],
  ['Загружаем объекты города…','Loading city places…','正在加载城市地点…'],
  ['Загружаем прогноз…','Loading the forecast…','正在加载天气预报…'],
  ['Не удалось загрузить данные города.','Could not load the city data.','无法加载城市数据。'],
  ['Повторить','Try again','重试'],
  ['Достопримечательности','Attractions','景点'],
  ['Что посмотреть','Attractions','景点'],
  ['Рестораны','Restaurants','餐厅'],
  ['Отели','Hotels','酒店'],
  ['Планы и стройки','Projects and works','规划与建设'],
  ['Все места','All places','所有地点'],
  ['Карта города','City map','城市地图'],
  ['Места и проекты','Places and projects','地点与项目'],
  ['Найти место по названию','Find a place by name','按名称查找地点'],
  ['По этому названию ничего не найдено.','No places match that name.','未找到名称匹配的地点。'],
  ['Каталог города временно недоступен.','The city catalogue is temporarily unavailable.','该城市的目录暂时无法加载。'],
  ['В этой выборке нет объектов выбранной категории.','No places in this category were found in the current search.','当前检索未返回此类别的地点。'],
  ['По этому городу пока нет записей из подключённых источников проектов.','The connected project sources have no records for this city yet.','已接入的项目数据源暂无该城市的记录。'],
  ['Показать ещё {count}','Show {count} more','再显示 {count} 个'],
  ['Проект опубликован','Published project','已公布项目'],
  ['Разрешение на строительство','Building permit','施工许可'],
  ['Идут работы','Work in progress','正在施工'],
  ['Опубликовано {date}','Published {date}','公布日期 {date}'],
  ['Открыть источник','Open source','打开数据源'],
  ['Сохранённая выборка','Saved data','已保存数据'],
  ['Размещение в регионе','Accommodation in the region','地区住宿'],
  ['Показатели по всему региону','Figures for the entire region','全地区统计数据'],
  ['Ночёвки','Overnight stays','住宿夜数'],
  ['Размещённые лица','Guests accommodated','接待住宿人数'],
  ['Данные за {month}','Figures for {month}','{month} 数据'],
  ['Нет сопоставимого месячного ряда для этого региона.','No comparable monthly series for this region.','该地区暂无可比的月度数据序列。'],
  ['Загрузка ряда Росстата…','Loading Rosstat data…','正在加载俄罗斯统计局数据…'],
  ['Погода на три дня','Three-day forecast','未来三天天气'],
  ['Вопрос по городу','Ask about this city','询问此城市'],
  ['В маршрут','Add to itinerary','加入行程'],
  ['Объекты в городе и окрестностях','Places in and around the city','城市及周边地点'],
]);

const filters = {all:'Все места',visit:'Достопримечательности',food:'Рестораны',stay:'Отели',project:'Планы и стройки'};
const stages={permit:'Разрешение на строительство',works:'Идут работы',planned:'Проект опубликован'};
const cityCache=new Map();
const catalogCache=new Map();
const weatherCache=new Map();
const seriesCache=new Map();
const dataTtl=180_000;
let lastChosenCity;
const sourceLink=(url,label)=>{
  try {
    const link=new URL(url);
    if (['http:','https:'].includes(link.protocol)) return '<a href="'+escape(link.href)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>';
  } catch { /* Some records have no linked source. */ }
  return '';
};
const escape=value=>String(value??'').replace(/[&<>"']/gu,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const msg=(key,values)=>escape(t(key,values));
const translated=(item,key='name')=>getLocale()==='zh' ? item[key==='name'?'cn':key+'Cn'] || item[key] :
  getLocale()==='en' ? item[key==='name'?'en':key+'En'] || item[key] : item[key];
const regionName=city=>getLocale()==='zh' ? city.regionCn || city.region : getLocale()==='en' ? city.regionEn || city.region : city.region;
const validDate=value=>typeof value==='string' && Number.isFinite(Date.parse(value));
const dateLabel=(value,options)=>validDate(value) ? formatDate(value,options) : '';
const searchText=value=>String(value??'').normalize('NFKC').toLowerCase().replaceAll('ё','е').trim();

function getCached(cache,key) {
  const entry=cache.get(key);
  return entry && Date.now()-entry.at<dataTtl ? entry.value : null;
}
function addCached(cache,key,value) {
  if (cache.size>=16) cache.delete(cache.keys().next().value);
  cache.set(key,{at:Date.now(),value});
  return value;
}

function chooseMarkup() {
  return '<header class="city-overview-header"><h1>'+msg('Обзор')+'</h1></header>'+
    '<div class="city-overview-search"><label class="field" for="overview-city-query">'+msg('Найти город России')+
    '<input type="search" id="overview-city-query" placeholder="'+msg('Введите название города')+'" autocomplete="off" maxlength="100" aria-controls="overview-city-choices"></label>'+
    '<div id="overview-city-choices"></div></div><div id="overview-city-report"><p class="caption">'+
    msg('Выберите город, чтобы посмотреть объекты, погоду и данные о размещении.')+'</p></div><div id="overview-monitor" hidden></div>';
}

function cityChoicesMarkup(cities,short) {
  if (!cities.length) return '';
  return '<ul class="city-options'+(short?' city-options--compact':'')+'">'+cities.slice(0,6).map(city=>
    '<li><button type="button" data-overview-city="'+escape(city.id)+'"><span data-source-text>'+escape(translated(city))+'</span>'+
    (!short && regionName(city)?'<small data-source-text>'+escape(regionName(city))+'</small>':'')+'</button></li>').join('')+'</ul>';
}

function weatherMarkup(weather,{loading=false}={}) {
  const days=weather?.days??[];
  return '<section class="panel city-weather" id="city-overview-weather"><h3>'+msg('Погода на три дня')+'</h3>'+
    (days.length ? '<ul>'+days.map(day=>'<li><time datetime="'+escape(day.date)+'">'+
      escape(dateLabel(day.date,{weekday:'short',day:'numeric',month:'short'}))+'</time>'+
      '<span>'+escape(weatherSummary(day,weather.horizonDays,true))+'</span></li>').join('')+'</ul>' :
      '<p class="caption" role="status">'+msg(loading?'Загружаем прогноз…':'Прогноз сейчас недоступен.')+'</p>')+
    (days.some(day=>day.status==='forecast')?'<p class="caption">'+sourceLink(weather.source?.url,'Open-Meteo')+'</p>':'')+'</section>';
}

function catalogSourcesMarkup(sources=[]) {
  const links=sources.filter(entry=>entry.status!=='unavailable').map(entry=>
    sourceLink(entry.url,t(entry.name))+(entry.status==='snapshot'?' · '+msg('Сохранённая выборка'):'')+
    (validDate(entry.checkedAt)?' · '+escape(dateLabel(entry.checkedAt,{day:'numeric',month:'short'})):''));
  return links.length?'<p class="caption city-overview-attribution">'+links.join(' / ')+'</p>':'';
}

function placeInfoMarkup(place,cityId) {
  if (!place) return '';
  const detail=translated(place,'detail');
  const address=translated(place,'address');
  const stage=place.kind==='project' ? stages[place.stage] ?? stages.planned : filters[place.kind];
  const title=translated(place);
  const source=sourceLink(place.officialUrl??place.url,place.source?.name??place.source?.title??
    (typeof place.source==='string'?translated(place,'source'):t('Открыть источник')));
  const canPlan=['visit','food','stay'].includes(place.kind) && /^\d{1,12}$/u.test(cityId) &&
    typeof place.id==='string' && /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,79}$/u.test(place.id);
  const route=canPlan?'<a class="button-quiet" href="#route?'+escape(new URLSearchParams({
    city:cityId,place:place.id,label:title,kind:place.kind,
  }))+'">'+msg('В маршрут')+'</a>':'';
  return '<div class="city-place-info"><h4 tabindex="-1" data-source-text>'+escape(title)+'</h4><p>'+
    [stage && msg(stage),address && escape(address),validDate(place.publishedAt)&&msg('Опубликовано {date}',{
      date:dateLabel(place.publishedAt,{day:'numeric',month:'short',year:'numeric'})})].filter(Boolean).join(' · ')+'</p>'+
    (detail?'<p data-source-text>'+escape(detail)+'</p>':'')+
    (route||source?'<div class="city-place-actions">'+route+source+'</div>':'')+'</div>';
}

function hasCatalog(data) {
  return data.catalogSources.some(source=>source.status!=='unavailable');
}

function reportMarkup(data,places,sources,placeQuery) {
  const {city,region}=data;
  const regionLabel=region && (region.name===city.name?translated(city):translated(region));
  const ask=new URLSearchParams({city:city.id,...(region?.id?{region:region.id}:{})});
  const entries=Object.entries(filters).filter(([key])=>key==='all' || (key==='project'?sources.projects:sources.catalog)).map(([key,label])=>'<button type="button" data-overview-filter="'+key+
    '" aria-pressed="'+(key==='all')+'">'+(key==='project'?'<span class="city-project-symbol" aria-hidden="true">◇</span> ':'')+
    msg(key==='visit'?'Что посмотреть':label)+' <span data-overview-count>–</span></button>');
  return '<section class="city-overview-report" aria-labelledby="overview-city-title">'+
    '<header class="city-summary"><div><h2 id="overview-city-title" tabindex="-1" data-source-text>'+escape(translated(city))+'</h2>'+
    (regionLabel && regionLabel!==translated(city)?'<p class="caption" data-source-text>'+escape(regionLabel)+'</p>':'')+'</div>'+
    '<div class="city-summary-actions"><a href="#route?'+escape(new URLSearchParams({city:city.id}))+
    '" class="button" id="city-overview-route">'+msg('Собрать маршрут')+'</a>'+
    '<a class="button-quiet" href="#ask?'+escape(ask)+'">'+msg('Вопрос по городу')+'</a></div></header>'+
    (sources.catalog || sources.projects ? '<section class="city-overview-inventory" aria-label="'+msg('Места и проекты')+'">'+
    (sources.catalog?'<div id="city-overview-catalog-status" hidden></div>':'')+
    '<div class="city-inventory-filters" role="group" aria-label="'+msg('Места и проекты')+'">'+entries.join('')+'</div>'+
    (sources.catalog || places.length?'<label class="field city-place-search"><span class="sr-only">'+msg('Найти место по названию')+'</span>'+
    '<input id="overview-place-query" type="search" maxlength="120" autocomplete="off" value="'+escape(placeQuery)+
    '" placeholder="'+msg('Найти место по названию')+'" aria-controls="city-overview-rows"></label>':'')+
    '<div class="city-inventory-layout"><div id="city-overview-map" role="region" aria-label="'+msg('Карта города')+'"></div>'+
    '<div id="city-overview-objects"><div id="city-overview-place" aria-live="polite"></div><div id="city-overview-rows"></div></div></div>'+
    (sources.catalog ? '<p class="caption city-inventory-scope">'+msg('Объекты в городе и окрестностях')+'</p><div id="city-overview-catalog-sources"></div>':'')+'</section>':'')+
    '<div class="city-conditions">'+(sources.statistics?'<section class="panel city-demand"><div class="city-demand-head"><h3>'+msg('Размещение в регионе')+
    '</h3><label class="field"><span class="sr-only">'+msg('Показатель')+'</span><select id="overview-city-metric">'+
    '<option value="people">'+msg('Размещённые лица')+'</option><option value="nights">'+msg('Ночёвки')+'</option></select></label></div>'+
    (regionLabel?'<p class="caption">'+msg('Показатели по всему региону')+' · <span data-source-text>'+escape(regionLabel)+'</span></p>':'')+
    '<div id="city-overview-demand"></div></section>':'')+(sources.weather?weatherMarkup(null,{loading:true}):'')+'</div></section>';
}

function demandMarkup(series,renderChart) {
  if (!series?.summary || !series.summary.years?.length) return '<p class="caption">'+
    msg('Нет сопоставимого месячного ряда для этого региона.')+'</p>';
  const {summary}=series;
  const last=summary.years.findLast(year=>year.monthly?.some(Number.isFinite));
  const month=last?.monthly.findLastIndex(Number.isFinite)??-1;
  const amount=month>=0 ? '<div class="city-demand-latest"><strong>'+escape(formatNumber(last.monthly[month]))+' '+
    msg(summary.unit)+'</strong><span class="caption">'+msg('Данные за {month}',{
      month:formatDate(Date.UTC(last.year,month,1),{month:'long',year:'numeric'}),
    })+'</span></div>':'';
  return amount+(last?renderChart(statSummary(summary,[last.year])):'')+'<p class="caption">'+[
    sourceLink(summary.publication,t('Росстат')),sourceLink(summary.source,'Roschart'),
    series.sourceStatus==='cached' && msg('Сохранённая выборка'),
  ].filter(Boolean).join(' · ')+'</p>';
}

export function mountCityOverview(container,api,{initialCity,renderChart,renderMonitoring}) {
  container.innerHTML=chooseMarkup();
  const find=selector=>container.querySelector(selector);
  const input=find('#overview-city-query');
  const choiceList=find('#overview-city-choices');
  const report=find('#overview-city-report');
  const monitor=find('#overview-monitor');
  const sources=Object.fromEntries(['catalog','projects','statistics','weather'].map(id=>[id,sourceEnabled(id)]));
  const placeLimit=()=>window.matchMedia('(max-width: 520px)').matches ? 4 : 8;
  let mounted=true;
  let queryTimer;
  let queryRequest;
  let cityRequest;
  let statsRequest;
  let matches=[];
  let data;
  let map;
  let places=[];
  let filter='all';
  let placeQuery='';
  let selected;
  let limit=placeLimit();
  let cityId;
  let metric='people';
  let catalogPending=false;

  function updateOverviewLink() {
    const params=new URLSearchParams(location.hash.split('?')[1]);
    params.set('city',cityId);
    if (filter==='all') params.delete('category');
    else params.set('category',filter);
    if (placeQuery.trim()) params.set('q',placeQuery.trim());
    else params.delete('q');
    if (selected) params.set('place',selected);
    else params.delete('place');
    history.replaceState(history.state,'','#overview?'+params);
  }

  async function search(query) {
    queryRequest?.abort();
    const controller=new AbortController();
    queryRequest=controller;
    choiceList.innerHTML=query?'<p class="caption" role="status">'+msg('Ищем города…')+'</p>':'';
    try {
      const {cities}=await api('cities'+(query?'?q='+encodeURIComponent(query):''),undefined,'GET',{signal:controller.signal});
      if (!mounted || controller.signal.aborted) return;
      matches=cities;
      choiceList.innerHTML=cities.length?cityChoicesMarkup(cities,!query):
        '<p class="caption" role="status">'+msg('Города по этому запросу не найдены.')+'</p>';
    } catch {
      if (!mounted || controller.signal.aborted) return;
      matches=[];
      choiceList.innerHTML='<p class="caption" role="status">'+msg('Поиск городов сейчас недоступен.')+'</p>';
    }
  }

  function visiblePlaces() {
    const needle=searchText(placeQuery);
    return places.filter(place=>(filter==='all' || place.kind===filter) && (!needle ||
      [place.name,place.en,place.cn,...(place.aliases ?? [])].some(label=>searchText(label).includes(needle))));
  }

  function collectPlaces() {
    places=[...data.places,...data.projects.records.map(place=>({...place,kind:'project',city:data.city.name}))];
  }

  function paintInventory() {
    const available=hasCatalog(data);
    const totals={
      all:catalogPending || (sources.catalog && !available && !places.length) ? null : places.length,
      ...(available ? data.counts : {}),
      project:data.projects.status==='published' ? data.projects.records.length : null,
    };
    for (const count of container.querySelectorAll('[data-overview-count]')) {
      const value=totals[count.parentElement.dataset.overviewFilter];
      count.textContent=Number.isFinite(value)?formatNumber(value):'–';
    }
    if (!sources.catalog) return;
    const status=find('#city-overview-catalog-status');
    status.hidden=available && !catalogPending;
    status.className=catalogPending?'city-place-search':'city-catalog-unavailable';
    status.innerHTML=status.hidden?'':'<p class="caption" role="status">'+
      msg(catalogPending?'Загружаем объекты города…':'Каталог города временно недоступен.')+'</p>'+
      (catalogPending?'':'<button type="button" class="button-quiet" data-overview-catalog-retry>'+msg('Повторить')+'</button>');
    find('#city-overview-catalog-sources').innerHTML=catalogSourcesMarkup(data.catalogSources);
  }

  function paintPlaces(frame=false) {
    const visible=visiblePlaces();
    const hits=visible.slice(0,limit);
    const detail=visible.find(place=>place.id===selected);
    const rows=find('#city-overview-rows');
    find('#city-overview-place').innerHTML=placeInfoMarkup(detail,cityId);
    rows.innerHTML=hits.length ? '<ul class="city-list">'+hits.map(place=>'<li><button type="button" data-overview-place="'+escape(place.id)+
      '" aria-pressed="'+(place.id===selected)+'"><strong data-source-text>'+escape(translated(place))+'</strong><small>'+
      msg(place.kind==='project'?stages[place.stage]??stages.planned:filters[place.kind])+'</small></button></li>').join('')+'</ul>'+
      (visible.length>hits.length?'<button type="button" class="button-quiet" data-overview-next>'+
        msg('Показать ещё {count}',{count:formatNumber(Math.min(8,visible.length-hits.length))})+'</button>':'') :
      filter!=='project' && sources.catalog && !hasCatalog(data) ? '' :
      '<p class="caption" role="status">'+msg(placeQuery.trim()?'По этому названию ничего не найдено.' :
        filter==='project' && data.projects?.status!=='published' ?
        'По этому городу пока нет записей из подключённых источников проектов.' :
        'В этой выборке нет объектов выбранной категории.')+'</p>';
    for (const button of container.querySelectorAll('[data-overview-filter]')) {
      button.setAttribute('aria-pressed',String(button.dataset.overviewFilter===filter));
    }
    const fit=frame ? visible.some(place=>Array.isArray(place.coordinates)) ? 'places' : true : false;
    map?.update({places:visible,geodata:data.geodata,showPlaces:true,base:'streets',frame:fit,groupByCity:false,
      selectedId:selected,locale:getLocale()});
  }

  function inspectPlace(placeId,{keyboard,fromList=false}) {
    selected=placeId;
    updateOverviewLink();
    paintPlaces();
    if (fromList) map?.select(selected,{focus:true});
    const detail=find('.city-place-info');
    if (!detail) return;
    if (keyboard) detail.querySelector('h4')?.focus({preventScroll:true});
    detail.scrollIntoView({block:'nearest',inline:'nearest'});
  }

  async function loadStatistic() {
    if (!sources.statistics) return;
    statsRequest?.abort();
    const detail=find('#city-overview-demand');
    if (!data.region?.id) {detail.innerHTML=demandMarkup(null,renderChart);return;}
    const key=data.region.id+'-'+metric;
    const cached=getCached(seriesCache,key);
    if (cached) {detail.innerHTML=demandMarkup(cached,renderChart);return;}
    const controller=new AbortController();
    statsRequest=controller;
    detail.innerHTML='<p class="caption" role="status">'+msg('Загрузка ряда Росстата…')+'</p>';
    try {
      const year=new Date().getUTCFullYear();
      const result=await api('regional-statistics',{regionId:data.region.id,metric,years:[year-2,year-1,year]},'POST',{signal:controller.signal});
      if (mounted && !controller.signal.aborted) {
        if (result.summary) addCached(seriesCache,key,result);
        detail.innerHTML=demandMarkup(result,renderChart);
      }
    } catch {
      if (mounted && !controller.signal.aborted) detail.innerHTML=demandMarkup(null,renderChart);
    }
  }

  async function requestCityPart(id,parts,cache,signal,cacheable=()=>true) {
    const query=new URLSearchParams({cityId:id,...parts});
    const key=query.toString();
    const cached=getCached(cache,key);
    if (cached) return cached;
    try {
      const result=await api('city-overview?'+query,undefined,'GET',{signal});
      if (!signal.aborted && cacheable(result)) addCached(cache,key,result);
      return result;
    } catch {
      return null;
    }
  }

  function loadCatalog(id,signal) {
    return requestCityPart(id,{projects:'0',weather:'0'},catalogCache,signal,hasCatalog);
  }

  function revealPlace(id,placeId) {
    if (!placeId) return;
    requestAnimationFrame(()=>{
      if (mounted && cityId===id && selected===placeId) find('.city-place-info')?.scrollIntoView({block:'nearest'});
    });
  }

  async function fillCatalog(request,id,signal) {
    const result=await request;
    if (!mounted || signal.aborted) return;
    const hadPlace=Boolean(find('.city-place-info'));
    catalogPending=false;
    if (result) {
      data.places=result.places;
      data.counts=result.counts;
      data.catalogSources=result.catalogSources;
      data.geodata={...result.geodata,places:{...data.geodata.places,...result.geodata.places}};
    }
    collectPlaces();
    if (hasCatalog(data) && selected) {
      selected=visiblePlaces().find(place=>place.id===selected || place.sourceIds?.includes(selected))?.id ?? null;
    }
    updateOverviewLink();
    paintInventory();
    paintPlaces(!hadPlace);
    if (!hadPlace) revealPlace(id,selected);
  }

  async function selectCity(id,{focus=false,reveal=false,category,placeId,nameQuery}={}) {
    if (!/^\d{1,12}$/u.test(id)) return;
    clearTimeout(queryTimer);
    queryRequest?.abort();
    cityRequest?.abort();
    statsRequest?.abort();
    map?.destroy();
    map=null;
    data=null;
    cityId=id;
    filter=Object.hasOwn(filters,category) && (category==='project'?sources.projects:sources.catalog) ? category : 'all';
    placeQuery=nameQuery?.slice(0,120) ?? '';
    selected=placeId;
    catalogPending=sources.catalog;
    limit=placeLimit();
    monitor.hidden=true;
    monitor.replaceChildren();
    choiceList.replaceChildren();
    matches=[];
    report.innerHTML='<p class="caption" role="status">'+msg('Загружаем данные города…')+'</p>';
    const controller=new AbortController();
    cityRequest=controller;
    const {signal}=controller;
    const coreRequest=requestCityPart(id,{catalog:'0',weather:'0',...(sources.projects?{}:{projects:'0'})},cityCache,signal);
    const catalogRequest=sources.catalog ? loadCatalog(id,signal) : null;
    const weatherRequest=sources.weather ? requestCityPart(id,{catalog:'0',projects:'0'},weatherCache,signal,
      result=>result.weather?.days?.some(day=>day.status==='forecast')) : null;
    const core=await coreRequest;
    if (!mounted || signal.aborted) return;
    if (!core) {
      controller.abort();
      report.innerHTML='<p class="caption" role="status">'+msg('Не удалось загрузить данные города.')+
        '</p><button type="button" class="button-quiet" data-overview-retry>'+msg('Повторить')+'</button>';
      return;
    }
    data={...core};
    collectPlaces();
    const loadedPlace=visiblePlaces().some(place=>place.id===selected);
    if (!catalogPending && !loadedPlace) selected=null;
    lastChosenCity=id;
    input.value=translated(data.city);
    const params=new URLSearchParams(location.hash.split('?')[1]);
    updateOverviewLink();
    report.innerHTML=reportMarkup(data,places,sources,placeQuery);
    const mapElement=find('#city-overview-map');
    if (mapElement) {
      map=createRouteMap(mapElement,{locale:getLocale(),minZoom:0,zoomPosition:'topright',
        onSelect(placeId,place,{keyboard}){inspectPlace(placeId,{keyboard});}});
      paintInventory();
      paintPlaces(true);
    }
    const metricPicker=find('#overview-city-metric');
    if (metricPicker) metricPicker.value=metric;
    if (data.region?.id==='83') {
      monitor.innerHTML=renderMonitoring(id);
      monitor.hidden=false;
      if (params.get('focus')==='programmes') find('#ops-programmes')?.focus();
    }
    const title=find('#overview-city-title');
    if (focus) title.focus();
    if (reveal && window.matchMedia('(max-width: 520px)').matches) title.scrollIntoView({block:'start'});
    if (loadedPlace) revealPlace(id,selected);
    void loadStatistic();
    if (catalogRequest) void fillCatalog(catalogRequest,id,signal);
    if (weatherRequest) void weatherRequest.then(result=>{
      if (mounted && !signal.aborted) find('#city-overview-weather').outerHTML=weatherMarkup(result?.weather);
    });
  }

  function onInput(event) {
    if (event.target.id==='overview-place-query') {
      placeQuery=event.target.value;
      if (!visiblePlaces().some(place=>place.id===selected)) selected=null;
      limit=placeLimit();
      updateOverviewLink();
      paintPlaces(true);
      return;
    }
    if (event.target!==input) return;
    clearTimeout(queryTimer);
    queryRequest?.abort();
    matches=[];
    choiceList.replaceChildren();
    const text=input.value.trim();
    if (text.length===1) return;
    queryTimer=setTimeout(()=>void search(text),170);
  }

  function onClick(event) {
    const button=event.target.closest('button');
    if (!button) return;
    const {overviewCity,overviewFilter,overviewPlace}=button.dataset;
    if (overviewCity) {
      const keyboard=event.detail===0;
      void selectCity(overviewCity,{focus:keyboard,reveal:!keyboard});
    } else if (overviewFilter) {
      filter=overviewFilter;
      selected=null;
      limit=placeLimit();
      updateOverviewLink();
      paintPlaces(true);
    } else if (overviewPlace) {
      inspectPlace(overviewPlace,{keyboard:event.detail===0,fromList:true});
    } else if (Object.hasOwn(button.dataset,'overviewNext')) {
      const previous=limit;
      limit+=8;
      paintPlaces();
      container.querySelectorAll('[data-overview-place]')[previous]?.focus();
    } else if (Object.hasOwn(button.dataset,'overviewRetry')) {
      void selectCity(cityId,{focus:true,category:filter,placeId:selected,nameQuery:placeQuery});
    } else if (Object.hasOwn(button.dataset,'overviewCatalogRetry')) {
      catalogPending=true;
      paintInventory();
      void fillCatalog(loadCatalog(cityId,cityRequest.signal),cityId,cityRequest.signal);
    }
  }

  function onChange(event) {
    if (event.target.id!=='overview-city-metric') return;
    metric=event.target.value;
    void loadStatistic();
  }

  function onKey(event) {
    if (event.target!==input || event.key!=='Enter' || event.isComposing || !matches.length) return;
    const typed=input.value.toLocaleLowerCase().trim();
    const exact=matches.filter(city=>[city.name,city.en,city.cn].some(name=>name?.toLocaleLowerCase()===typed));
    if ((exact.length || matches.length)===1) void selectCity((exact[0]??matches[0]).id,{focus:true});
    else choiceList.querySelector('button')?.focus();
  }

  container.addEventListener('input',onInput);
  container.addEventListener('click',onClick);
  container.addEventListener('change',onChange);
  container.addEventListener('keydown',onKey);
  if (initialCity && /^\d{1,12}$/u.test(initialCity)) {
    const params=new URLSearchParams(location.hash.split('?')[1]);
    void selectCity(initialCity,{category:params.get('category'),placeId:params.get('place'),nameQuery:params.get('q')});
  }
  else if (lastChosenCity) void selectCity(lastChosenCity);
  else void search('');

  return {refreshMonitoring(){
    if (!monitor.hidden) monitor.innerHTML=renderMonitoring(cityId);
  },destroy(){
    mounted=false;
    clearTimeout(queryTimer);
    queryRequest?.abort();
    cityRequest?.abort();
    statsRequest?.abort();
    map?.destroy();
    container.removeEventListener('input',onInput);
    container.removeEventListener('click',onClick);
    container.removeEventListener('change',onChange);
    container.removeEventListener('keydown',onKey);
  }};
}
