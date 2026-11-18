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
  ['Не удалось загрузить данные города.','Could not load the city data.','无法加载城市数据。'],
  ['Повторить','Try again','重试'],
  ['Достопримечательности','Attractions','景点'],
  ['Рестораны','Restaurants','餐厅'],
  ['Отели','Hotels','酒店'],
  ['Планы и стройки','Projects and works','规划与建设'],
  ['Все места','All places','所有地点'],
  ['Карта города','City map','城市地图'],
  ['Места и проекты','Places and projects','地点与项目'],
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
  ['Объекты в городе и окрестностях','Places in and around the city','城市及周边地点'],
]);

const filters = {all:'Все места',visit:'Достопримечательности',food:'Рестораны',stay:'Отели',project:'Планы и стройки'};
const stages={permit:'Разрешение на строительство',works:'Идут работы',planned:'Проект опубликован'};
const cityCache=new Map();
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
  return '<header class="city-overview-header"><h1>'+msg('Обзор')+'</h1>'+
    '<a href="#route" class="button-quiet" id="city-overview-route">'+msg('Собрать маршрут')+'</a></header>'+
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

function weatherMarkup(weather) {
  const days=weather?.days??[];
  return '<section class="panel city-weather"><h3>'+msg('Погода на три дня')+'</h3>'+
    (days.length ? '<ul>'+days.map(day=>'<li><time datetime="'+escape(day.date)+'">'+
      escape(dateLabel(day.date,{weekday:'short',day:'numeric',month:'short'}))+'</time>'+
      '<span>'+escape(weatherSummary(day,weather.horizonDays,true))+'</span></li>').join('')+'</ul>' :
      '<p class="caption">'+msg('Прогноз сейчас недоступен.')+'</p>')+
    (days.some(day=>day.status==='forecast')?'<p class="caption">'+sourceLink(weather.source?.url,'Open-Meteo')+'</p>':'')+'</section>';
}

function catalogSourcesMarkup(sources=[]) {
  const links=sources.filter(entry=>entry.status!=='unavailable').map(entry=>
    sourceLink(entry.url,t(entry.name))+(entry.status==='snapshot'?' · '+msg('Сохранённая выборка'):'')+
    (validDate(entry.checkedAt)?' · '+escape(dateLabel(entry.checkedAt,{day:'numeric',month:'short'})):''));
  return links.length?'<p class="caption city-overview-attribution">'+links.join(' / ')+'</p>':'';
}

function placeInfoMarkup(place) {
  if (!place) return '';
  const detail=translated(place,'detail');
  const address=translated(place,'address');
  const stage=place.kind==='project' ? stages[place.stage] ?? stages.planned : filters[place.kind];
  return '<div class="city-place-info"><h4 data-source-text>'+escape(translated(place))+'</h4><p>'+
    [stage && msg(stage),address && escape(address),validDate(place.publishedAt)&&msg('Опубликовано {date}',{
      date:dateLabel(place.publishedAt,{day:'numeric',month:'short',year:'numeric'})})].filter(Boolean).join(' · ')+'</p>'+
    (detail?'<p data-source-text>'+escape(detail)+'</p>':'')+
    (place.url||place.officialUrl?'<p>'+sourceLink(place.officialUrl??place.url,place.source?.name??place.source?.title??
      (typeof place.source==='string'?translated(place,'source'):t('Открыть источник')))+'</p>':'')+'</div>';
}

function reportMarkup(data,places,sources) {
  const {city,region,counts}=data;
  const regionLabel=region && (region.name===city.name?translated(city):translated(region));
  const projectCount=data.projects?.status==='published' ? data.projects.records.length : '–';
  const totals={all:places.length,...counts,project:projectCount};
  const ask=new URLSearchParams({city:city.id,...(region?.id?{region:region.id}:{})});
  const entries=Object.entries(filters).filter(([key])=>key==='all' || (key==='project'?sources.projects:sources.catalog)).map(([key,label])=>'<button type="button" data-overview-filter="'+key+
    '" aria-pressed="'+(key==='all')+'">'+(key==='project'?'<span class="city-project-symbol" aria-hidden="true">◇</span> ':'')+
    msg(label)+' <span>'+escape(Number.isFinite(totals[key])?formatNumber(totals[key]):'–')+'</span></button>');
  return '<section class="city-overview-report" aria-labelledby="overview-city-title">'+
    '<header class="city-summary"><div><h2 id="overview-city-title" tabindex="-1" data-source-text>'+escape(translated(city))+'</h2>'+
    (regionLabel && regionLabel!==translated(city)?'<p class="caption" data-source-text>'+escape(regionLabel)+'</p>':'')+'</div>'+
    '<a class="button-quiet" href="#ask?'+escape(ask)+'">'+msg('Вопрос по городу')+'</a></header>'+
    (sources.catalog || sources.projects ? '<section class="city-overview-inventory" aria-label="'+msg('Места и проекты')+'">'+
    '<div class="city-inventory-filters" role="group" aria-label="'+msg('Места и проекты')+'">'+entries.join('')+'</div>'+
    '<div class="city-inventory-layout"><div id="city-overview-map" role="region" aria-label="'+msg('Карта города')+'"></div>'+
    '<div id="city-overview-objects"><div id="city-overview-place" aria-live="polite"></div><div id="city-overview-rows"></div></div></div>'+
    (sources.catalog ? '<p class="caption city-inventory-scope">'+msg('Объекты в городе и окрестностях')+'</p>'+catalogSourcesMarkup(data.catalogSources):'')+'</section>':'')+
    '<div class="city-conditions">'+(sources.statistics?'<section class="panel city-demand"><div class="city-demand-head"><h3>'+msg('Размещение в регионе')+
    '</h3><label class="field"><span class="sr-only">'+msg('Показатель')+'</span><select id="overview-city-metric">'+
    '<option value="people">'+msg('Размещённые лица')+'</option><option value="nights">'+msg('Ночёвки')+'</option></select></label></div>'+
    (regionLabel?'<p class="caption">'+msg('Показатели по всему региону')+' · <span data-source-text>'+escape(regionLabel)+'</span></p>':'')+
    '<div id="city-overview-demand"></div></section>':'')+(sources.weather?weatherMarkup(data.weather):'')+'</div></section>';
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
  const routeLink=find('#city-overview-route');
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
  let selected;
  let limit=placeLimit();
  let cityId;
  let metric='people';

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

  function paintPlaces(frame=false) {
    const visible=filter==='all'?places:places.filter(place=>place.kind===filter);
    const hits=visible.slice(0,limit);
    const detail=visible.find(place=>place.id===selected);
    const rows=find('#city-overview-rows');
    find('#city-overview-place').innerHTML=placeInfoMarkup(detail);
    rows.innerHTML=hits.length ? '<ul class="city-list">'+hits.map(place=>'<li><button type="button" data-overview-place="'+escape(place.id)+
      '" aria-pressed="'+(place.id===selected)+'"><strong data-source-text>'+escape(translated(place))+'</strong><small>'+
      msg(place.kind==='project'?stages[place.stage]??stages.planned:filters[place.kind])+'</small></button></li>').join('')+'</ul>'+
      (visible.length>hits.length?'<button type="button" class="button-quiet" data-overview-next>'+
        msg('Показать ещё {count}',{count:formatNumber(Math.min(8,visible.length-hits.length))})+'</button>':'') :
      '<p class="caption">'+msg(filter==='project' && data.projects?.status!=='published' ?
        'По этому городу пока нет записей из подключённых источников проектов.' :
        'В этой выборке нет объектов выбранной категории.')+'</p>';
    for (const button of container.querySelectorAll('[data-overview-filter]')) {
      button.setAttribute('aria-pressed',String(button.dataset.overviewFilter===filter));
    }
    const fit=frame ? visible.some(place=>Array.isArray(place.coordinates)) ? 'places' : true : false;
    map?.update({places:visible,geodata:data.geodata,showPlaces:true,base:'streets',frame:fit,groupByCity:false,
      selectedId:selected,locale:getLocale()});
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

  async function selectCity(id,{focus=false}={}) {
    if (!/^\d{1,12}$/u.test(id)) return;
    clearTimeout(queryTimer);
    queryRequest?.abort();
    cityRequest?.abort();
    statsRequest?.abort();
    map?.destroy();
    map=null;
    data=null;
    cityId=id;
    filter='all';
    selected=null;
    limit=placeLimit();
    routeLink.href='#route';
    monitor.hidden=true;
    monitor.replaceChildren();
    choiceList.replaceChildren();
    matches=[];
    report.innerHTML='<p class="caption" role="status">'+msg('Загружаем данные города…')+'</p>';
    const controller=new AbortController();
    cityRequest=controller;
    try {
      const query=new URLSearchParams({cityId:id});
      for (const name of ['catalog','projects','weather']) if (!sources[name]) query.set(name,'0');
      const cacheKey=query.toString();
      const cached=getCached(cityCache,cacheKey);
      const response=cached??await api('city-overview?'+query,undefined,'GET',{signal:controller.signal});
      if (!mounted || controller.signal.aborted) return;
      data=cached??addCached(cityCache,cacheKey,response);
      const {city,geodata,projects}=data;
      lastChosenCity=id;
      places=[...(sources.catalog?data.places??[]:[]),...(sources.projects?projects?.records??[]:[])
        .map(place=>({...place,kind:'project',city:city.name}))];
      input.value=translated(city);
      routeLink.href='#route?'+new URLSearchParams({city:id});
      const params=new URLSearchParams(location.hash.split('?')[1]);
      params.set('city',id);
      history.replaceState(history.state,'','#overview?'+params);
      report.innerHTML=reportMarkup(data,places,sources);
      const mapElement=find('#city-overview-map');
      if (mapElement && geodata) {
        map=createRouteMap(mapElement,{locale:getLocale(),minZoom:0,zoomPosition:'topright',
          onSelect(placeId){selected=placeId;paintPlaces();}});
      } else if (mapElement) mapElement.hidden=true;
      if (mapElement) paintPlaces(true);
      const metricPicker=find('#overview-city-metric');
      if (metricPicker) metricPicker.value=metric;
      if (data.region?.id==='83') {
        monitor.innerHTML=renderMonitoring();
        monitor.hidden=false;
        if (params.get('focus')==='programmes') find('#ops-programmes')?.focus();
      }
      if (focus) find('#overview-city-title').focus();
      void loadStatistic();
    } catch {
      if (!mounted || controller.signal.aborted) return;
      report.innerHTML='<p class="caption" role="status">'+msg('Не удалось загрузить данные города.')+
        '</p><button type="button" class="button-quiet" data-overview-retry>'+msg('Повторить')+'</button>';
    }
  }

  function onInput(event) {
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
      void selectCity(overviewCity,{focus:true});
    } else if (overviewFilter) {
      filter=overviewFilter;
      selected=null;
      limit=placeLimit();
      paintPlaces(true);
    } else if (overviewPlace) {
      selected=overviewPlace;
      paintPlaces();
      map?.select(selected,{focus:true});
      [...container.querySelectorAll('[data-overview-place]')].find(item=>item.dataset.overviewPlace===selected)?.focus({preventScroll:true});
    } else if (Object.hasOwn(button.dataset,'overviewNext')) {
      const previous=limit;
      limit+=8;
      paintPlaces();
      container.querySelectorAll('[data-overview-place]')[previous]?.focus();
    } else if (Object.hasOwn(button.dataset,'overviewRetry')) {
      void selectCity(cityId,{focus:true});
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
  if (initialCity && /^\d{1,12}$/u.test(initialCity)) void selectCity(initialCity);
  else if (lastChosenCity) void selectCity(lastChosenCity);
  else void search('');

  return {refreshMonitoring(){
    if (!monitor.hidden) monitor.innerHTML=renderMonitoring();
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
