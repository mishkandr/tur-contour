import { assess, clockTime, kindNames, planRoute, previewPublishedRoute, publishedHours, routeAlternatives, routeSettings } from '/engine.mjs';
import { createRouteMap } from '/map.js';
import { addLocaleMessages, formatDate, formatNumber, getLocale, localizeDom, t } from '/locale.js';

addLocaleMessages([
  ['Объекты и условия','Places and conditions','地点与参观条件'],
  ['Программа на карте','Itinerary shown on map','地图上的行程'],
  ['Все объекты региона','All places in the region','本地区所有地点'],
  ['Режим проверки','Evidence mode','核查模式'],
  ['Найти объект','Find a place','查找地点'],
  ['Название или город','Name or city','名称或城市'],
  ['Улицы загружены частично · схема поездки','Street tiles partially loaded · route diagram','街道底图部分加载 · 路线示意图'],
  ['{dates} · {count} чел.','{dates} · {count} people','{dates} · {count} 人'],
  ['День {day}','Day {day}','第 {day} 天'],
  ['Нет объектов для этого фильтра.','No places match this filter.','没有符合此筛选条件的地点。'],
  ['На карте: {count}','On the map: {count}','地图上：{count} 个'],
  ['Дата визита','Visit date','到访日期'],
  ['Размер группы','Group size','团队人数'],
  ['Учебная программа: {name}','Training itinerary: {name}','演示行程：{name}'],
  ['Покрытие данных','Data coverage','数据覆盖'],
  ['Сравнение условий','Compare conditions','比较条件'],
  ['{count} чел.','{count} people','{count} 人'],
  ['{count} в плане','{count} scheduled','已安排 {count} 个'],
  ['в программе','in itinerary','已列入行程'],
  ['два сеанса','two sessions','两个场次'],
  ['Сравниваем один и тот же набор дат и групп.','Comparison uses the same dates and groups.','比较使用相同的日期与团队。'],
  ['Учебные программы','Training itineraries','演示行程'],
  ['Рабочие программы','Working itineraries','工作行程'],
  ['Изменения программы','Itinerary changes','行程变更'],
  ['Собрать маршрут','Build an itinerary','编制行程'],
  ['Текущая рабочая проверка','Current working review','当前工作核查'],
  ['Рабочая проверка','Working review','工作核查'],
  ['Вернуться к проверке','Back to itinerary review','返回行程核查'],
  ['Открыть программу на карте','Show this itinerary on the map','在地图上显示此行程'],
  ['Пересчитайте программу для карты','Recalculate to open the map','重新计算后打开地图'],
  ['{date} · {days} дня · {size} чел.','{date} · {days} days · {size} people','{date} · {days} 天 · {size} 人'],
  ['Точки черновика','Draft stops','行程草案停留点'],
  ['Предварительное время','Provisional time','暂定时间'],
  ['Показать объекты на карте','Fit the visible places','显示地图上的地点'],
  ['Изменение','Change','变化'],
  ['Черновик по опубликованным графикам. Запись, вместимость и сопровождение требуют подтверждения.',
    'Draft based on published opening hours. Booking, capacity and group support still need confirmation.',
    '草案依据公布的开放时间。预约、接待人数和团队服务仍需确认。'],
]);

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const dayDate = value => formatDate(value,{day:'numeric',month:'long'});
const placeName = place => getLocale()==='zh' ? place.cn || place.name : getLocale()==='en' ? place.en || place.name : place.name;
const programName = title => title.split(' → ').map(city=>t(city)).join(' → ');
const actions = [
  ['route','Точки маршрута'],
  ['all','Все объекты'],
  ['risk','Ограничения'],
  ['official','Официальные графики'],
];
const statusTitles = { ready:'Подходит в демо', blocked:'Есть ограничение', unknown:'Нужна проверка' };

function option(label, action, value, active, disabled = false) {
  return '<button type="button" class="atlas-option" data-atlas="'+action+'" data-value="'+esc(value)+
    '" aria-pressed="'+active+'"'+(disabled?' disabled':'')+'>'+esc(t(label))+'</button>';
}

function stopCount(plan) {
  return plan.days.flatMap(day=>day.stops).filter(stop=>stop.id).length;
}

function calendarPlan(plan, selectedDay) {
  return selectedDay === 'all' ? plan : { ...plan, days:plan.days.filter((_, i)=>String(i)===selectedDay) };
}

export function pilotParameters(settings, variantId) {
  return new URLSearchParams({scope:'pilot',direction:settings.direction ?? 'vladimir-suzdal',date:settings.date,
    days:settings.days,size:settings.size,market:settings.market,theme:settings.theme,access:settings.access?'1':'0',
    ...(variantId ? {variant:variantId} : {})});
}

export function readPilotParameters(query) {
  if (query.get('scope')!=='pilot' || !query.has('date')) return null;
  const settings = routeSettings({...Object.fromEntries(query),access:query.get('access')==='1',demo:false});
  const variantId = query.get('variant');
  return {settings,variantId:/^programme-[a-z0-9]+$/u.test(variantId ?? '') ? variantId : null};
}

function placeFitsDay(place,day) {
  if (place.kind==='food') return place.city===(day.mealCity ?? day.city);
  if (place.kind==='stay') return place.city===(day.stayCity ?? day.city);
  return place.city===day.city && (!day.visitIds || day.visitIds.includes(place.id));
}

export function mountAtlas(container, initialData, geodata, { programId, placeId, initialLayer, pilot, restored, onOpenRoute, onOpenPlace }) {
  const activeProgram = initialData.affected.find(record=>record.id===programId);
  const workingPilot = pilot && {id:'working-pilot',settings:pilot.settings};
  const view = {
    group:workingPilot?.id ?? activeProgram?.id ?? '', day:'all',
    layer:actions.some(([key])=>key===initialLayer) ? initialLayer : activeProgram ? 'route' : 'official',
    base:'streets', selected:initialData.places.some(place=>place.id===placeId)?placeId:null, variant:'replacement',
    scenario:'split', scenarioScope:'demo', search:'',
    date:new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'}),size:8,...restored,
  };
  let data = initialData;
  let current;
  let workingPlan;
  const pilotLink = pilot ? '#route?'+pilotParameters(pilot.settings,pilot.variantId) : null;
  container.innerHTML = `
    <div class="atlas-heading">
      <div><p class="ops-kicker">Владимирская область</p><h1>Карта объектов</h1></div>
      <div class="atlas-heading-actions">
      <button class="button-quiet" type="button" data-atlas="portfolio" hidden>Сравнить условия <span aria-hidden="true">↓</span></button>
      <a class="button" href="${esc(pilotLink ?? '#route')}">${esc(t(pilotLink?'Вернуться к проверке':'Собрать маршрут'))} <span aria-hidden="true">↗</span></a></div>
    </div>
    <div class="atlas-workspace">
      <section class="atlas-map-shell" aria-label="Карта объектов и остановок">
        <div class="atlas-map-top"><label><span class="sr-only">Программа на карте</span><select id="atlas-program"></select></label>
          <div class="atlas-options atlas-days" id="atlas-days" role="group" aria-label="Дни маршрута"></div>
          <div class="atlas-map-tools" role="group" aria-label="Управление картой">
            <div class="atlas-base" id="atlas-base"></div>
            <button type="button" class="atlas-icon" data-atlas="fit" aria-label="Показать маршрут целиком" title="Показать маршрут целиком">⌖</button>
            <button type="button" class="atlas-icon" data-atlas="expand" aria-label="Развернуть карту" title="Развернуть карту">⛶</button>
          </div>
        </div>
        <div class="atlas-map-scene">
          <div id="tour-map" role="region" aria-label="Интерактивная карта Владимирской области"></div>
        </div>
        <div class="atlas-map-bottom">
          <div class="atlas-options atlas-layers" id="atlas-layers" role="group" aria-label="Объекты на карте"></div>
          <span class="atlas-legend" id="atlas-legend" hidden><i></i> Другой вариант</span>
          <span id="atlas-map-note" class="atlas-map-note" aria-live="polite">Схема поездки</span>
        </div>
      </section>
      <section class="atlas-inspector" id="atlas-inspector" aria-label="Выбранная программа"></section>
    </div>
    <section class="portfolio" id="atlas-portfolio" aria-labelledby="portfolio-title" tabindex="-1"></section>
  `;
  const find = selector => container.querySelector(selector);
  const map = createRouteMap(find('#tour-map'), {
    locale:getLocale(),
    onSelect(id) {
      view.selected = id;
      paint(false);
      if (window.matchMedia('(max-width: 700px)').matches) find('#atlas-inspector').scrollIntoView({block:'nearest'});
    },
    onStatus(status) {
      const state = typeof status === 'string' ? status : status.tiles ?? status.status;
      find('#atlas-map-note').textContent = t(view.base==='scheme' ? 'Схема поездки'
        : state==='fallback' ? 'Улицы недоступны · схема поездки' : state==='partial' ?
          'Улицы загружены частично · схема поездки' : state==='loading' ? 'Загружаем улицы…' : 'Карта улиц');
    },
  });

  function record() {
    return workingPilot && view.group===workingPilot.id ? workingPilot : data.affected.find(item=>item.id===view.group);
  }

  function actualPlan() {
    const selected = record();
    if (!selected) return {days:[]};
    if (selected===workingPilot) {
      if (!workingPlan) {
        const variant = pilot.variantId && routeAlternatives(data.places,pilot.settings).find(item=>item.id===pilot.variantId);
        const confirmed = variant?.plan ?? planRoute(data.places,pilot.settings);
        workingPlan = confirmed.completeness ? confirmed : previewPublishedRoute(data.places,pilot.settings) ?? confirmed;
      }
      return workingPlan;
    }
    if (showSplit(selected) && view.variant === 'split') return planRoute(data.places, selected.settings, 'suzdal-kremlin');
    return selected.currentPlan ?? planRoute(data.places, selected.settings);
  }

  function showSplit(selected) {
    return selected.settings.demo && data.auditVersion === '2' && selected.affected && selected.removed.some(stop=>stop.id==='suzdal-kremlin');
  }

  function inspectionSettings(selected) {
    const settings = selected?.settings ?? {...data.affected[0].settings,date:view.date,size:view.size};
    return view.layer==='official' || !selected ? {...settings,demo:false} : settings;
  }

  function inspectionDay(place) {
    const index = view.day==='all' ? current.days.findIndex(day=>
      day.stops.some(stop=>stop.id===place.id)) : Number(view.day);
    if (index>=0 && (current.days[index].stops.some(stop=>stop.id===place.id) || placeFitsDay(place,current.days[index]))) return index;
    return Math.max(0,current.days.findIndex(day=>placeFitsDay(place,day)));
  }

  function details(place, planRecord) {
    const dayOffset = inspectionDay(place);
    const official = view.layer==='official';
    const settings = inspectionSettings(planRecord);
    const audit = settings.demo ? place.audit : place.verifiedAudit;
    const routeStop = !official && current.days[dayOffset]?.stops.find(stop=>stop.id===place.id);
    const state = assess(place, routeStop?.split ? {...settings,size:Math.ceil(settings.size/2)} : settings, dayOffset);
    const changed = !official && planRecord?.removed?.some(stop=>stop.id===place.id);
    const changedLimit = changed && audit && settings.size>audit.capacity;
    const hours = official ? publishedHours(place,settings.date,dayOffset) : null;
    const scheduleText = hours?.windows === null ? 'Дату нужно сверить' : hours?.windows?.length === 0 ? 'Закрыто по графику' :
      hours?.windows?.map(([start,end])=>clockTime(start)+'–'+clockTime(end)).join(', ');
    const source = esc(hours?.url ?? (!settings.demo && audit ? audit.sourceUrl : place.url));
    const point = geodata.places?.[place.id];
    return `
      <div class="atlas-detail">
        <div class="atlas-detail-head">
          <p class="atlas-overline">${esc(t(place.city))} · ${esc(t(kindNames[place.kind]))}</p>
          <button type="button" class="atlas-x" aria-label="Закрыть карточку точки" data-atlas="clear">×</button>
        </div>
        <h3 data-source-text>${esc(placeName(place))}</h3>
        ${getLocale()==='ru' && planRecord?.settings.market==='zh' && place.cn ? '<p lang="zh-Hans" class="atlas-chinese">'+esc(place.cn)+'</p>' : ''}
        <span class="atlas-status atlas-status--${state.status}"><i></i>${routeStop?.split ? 'В программе двумя сеансами' :
          state.status==='ready' && !settings.demo ? 'Условия подтверждены' : statusTitles[state.status]}</span>
        ${official ? `<p class="atlas-slot">${current.days[dayOffset] ? esc(dayDate(current.days[dayOffset].date))+' · ' : ''}${esc(hours?.label ?? 'Часы на дату визита')} · ${esc(t(scheduleText ?? 'Нужно уточнить'))}</p>` : ''}
        ${audit ? `<div class="atlas-facts"><div><span>${esc(t(settings.demo ? 'Лимит в демо' : 'Подтверждённый лимит'))}</span><strong>${esc(t('{count} чел.',{count:formatNumber(audit.capacity)}))}</strong></div>
          <div><span>Группа</span><strong>${esc(t('{count} чел.',{count:formatNumber(settings.size)}))}</strong></div></div>` : ''}
        ${routeStop ? '<p class="atlas-slot">'+esc(routeStop.start)+'–'+esc(routeStop.end)+' · '+esc(t(routeStop.split?'два сеанса':routeStop.provisional?'Предварительное время':'в программе'))+'</p>' : ''}
        ${changedLimit&&!routeStop?.split && showSplit(planRecord) ? '<p class="atlas-reason">Лимит изменился. Выберите замену или проверьте, помещаются ли два сеанса в расписание.</p>' :
          state.reasons.map(reason=>'<p class="atlas-reason">'+esc(reason)+'</p>').join('')}
        <div class="atlas-detail-links"><a href="${source}" target="_blank" rel="noopener noreferrer">Первоисточник ↗</a>
          <button type="button" class="link-button" data-atlas="passport" data-value="${esc(place.id)}">Паспорт объекта</button>
          ${point?.source ? '<a href="'+esc(point.source)+'" target="_blank" rel="noopener noreferrer">Координаты ↗</a>' : ''}
        </div>
      </div>`;
  }

  function stops(plan, offset) {
    const seen = new Set();
    return plan.days.flatMap((day, index)=>day.stops
      .filter(stop=>stop.id && !seen.has(stop.id) && seen.add(stop.id))
      .map(stop=>'<button type="button" class="atlas-stop" data-atlas="stop" data-value="'+esc(stop.id)+'" aria-pressed="'+(view.selected===stop.id)+
        '"><span class="atlas-stop-day">'+esc(t('День {day}',{day:index+offset+1}))+'</span><span data-source-text>'+
        esc(placeName(data.places.find(place=>place.id===stop.id) ?? stop))+'</span><span aria-hidden="true" class="atlas-arr">›</span></button>')).join('');
  }

  function placeRows(places) {
    return places.map(place=>'<button type="button" class="atlas-stop" data-atlas="stop" data-value="'+esc(place.id)+
      '" aria-pressed="'+(view.selected===place.id)+'"><span class="atlas-stop-day">'+esc(t(place.city))+'</span><span><strong data-source-text>'+
      esc(placeName(place))+'</strong><small class="map-list-status">'+esc(t(place.status==='ready'?'Условия подтверждены':statusTitles[place.status]))+
      '</small></span><span aria-hidden="true" class="atlas-arr">›</span></button>').join('');
  }

  function inspector(selected,places) {
    const point = data.places.find(place=>place.id===view.selected);
    if (!selected) return `
      <header class="atlas-inspector-head"><h2>Объекты и условия</h2>
        <p class="atlas-date">${esc(t('Опубликованные условия'))}</p>
        <div class="atlas-inspect-fields"><label class="field"><span>Дата визита</span><input id="map-visit-date" type="date" value="${esc(view.date)}" required></label>
        <label class="field"><span>Размер группы</span><input id="map-group-size" type="number" min="1" max="100" value="${view.size}" required></label></div>
        <label class="field atlas-search"><span>Найти объект</span><input id="map-place-search" type="search"
          placeholder="Название или город" value="${esc(view.search)}"></label>
      </header>
      ${point ? details(point,selected) : ''}
      <div class="atlas-stops"><p class="caption" id="atlas-list-count" aria-live="polite"></p><div class="atlas-list-box" id="atlas-search-list"></div></div>`;
    const affected = selected.affected;
    const official = view.layer==='official';
    const working = selected===workingPilot;
    const splitAvailable = !official && showSplit(selected);
    const hasSplit = current.days.flatMap(day=>day.stops).some(stop=>stop.split);
    const plan = calendarPlan(current,view.day);
    const visitDay = view.day==='all' ? null : current.days[Number(view.day)];
    const workingTitle = [...new Set(current.days.map(day=>day.city))].map(city=>t(city)).join(' → ');
    const alert = data.changes.find(change=>change.demo && change.id==='suzdal-kremlin' && change.key==='capacity');
    return `
      <header class="atlas-inspector-head"><p class="atlas-overline">${esc(t(working?'Рабочая проверка':official?'Сверка условий':'Маршрут под наблюдением'))}</p>
        <h2 data-source-text>${esc(working ? workingTitle : programName(selected.title))}</h2>
        <p class="atlas-date">${working ? esc(t('{date} · {days} дня · {size} чел.',{
          date:dayDate(selected.settings.date),days:formatNumber(selected.settings.days),size:formatNumber(selected.settings.size)})) :
          esc(t('{dates} · {count} чел.',{dates:dayDate(selected.settings.date),count:formatNumber(selected.settings.size)}))} ·
          ${esc(t(official?'Официальные источники':selected.settings.demo?'Учебный сценарий':current.publishedPreview?'Точки черновика':'По подтверждённым условиям'))}</p>
        ${working ? '<p class="atlas-date">'+esc(t(selected.settings.market==='zh'?'Группа из Китая':'Российская группа'))+
          (selected.settings.access?' · '+esc(t('Безбарьерный доступ')):'')+
          (visitDay?' · '+esc(dayDate(visitDay.date)):'')+'</p>' : ''}
      </header>
      ${working && !official && current.publishedPreview ? '<p class="atlas-reason atlas-published-note">'+esc(t('Черновик по опубликованным графикам. Запись, вместимость и сопровождение требуют подтверждения.'))+'</p>' : ''}
      ${splitAvailable ? `<div class="atlas-impact">
        <div class="atlas-impact-title"><span class="atlas-impact-icon" aria-hidden="true">!</span><strong>Суздальский кремль</strong></div>
        <p>Лимит в демо <strong>${alert?.before ?? 25} → ${alert?.after ?? 12} чел.</strong></p>
        <div class="atlas-options" role="group" aria-label="Варианты корректировки">
          ${option('Замена объекта','variant','replacement',view.variant==='replacement')}
          ${option('Два сеанса','variant','split',view.variant==='split')}
        </div>
        <p class="atlas-variant-note">${view.variant==='split'
          ? hasSplit ? 'Кремль остаётся в программе. Два сеанса нужно согласовать с музеем.' : 'Два сеанса не помещаются в расписание по учебным условиям.'
          : selected.added.length ? 'В программу добавлен '+esc(selected.added[0].name)+'.' : 'Нужна подтверждённая замена.'}</p>
      </div>` : affected && !official ? `<div class="atlas-impact"><div class="atlas-impact-title"><span class="atlas-impact-icon" aria-hidden="true">!</span>
        <strong>Программа требует пересмотра</strong></div><p>${esc(selected.issues[0]?.reasons?.[0] ?? 'Откройте программу и сравните доступные варианты.')}</p></div>` : ''}
      ${point ? details(point,selected) : ''}
      <div class="atlas-stops">
        <div class="atlas-stops-head"><h3>${esc(t(official?'Точки для сверки':current.publishedPreview?'Точки черновика':'Точки программы'))}</h3>${official ? '' :
          '<span>'+esc(t('{count} в плане',{count:formatNumber(stopCount(plan))}))+'</span>'}</div>
        ${(working && official ? placeRows(places) : stops(plan, view.day==='all'?0:Number(view.day))) || '<p class="atlas-reason">Пока нет точек на выбранный день.</p>'}
      </div>
      <div class="atlas-inspector-foot">${working ? '<a class="button-quiet" href="'+esc(pilotLink)+'">'+esc(t('Вернуться к проверке'))+' <span aria-hidden="true">→</span></a>' :
        official ? '<button type="button" class="button-quiet" data-atlas="open-official">Проверить условия программы <span aria-hidden="true">→</span></button>' :
        '<button type="button" class="button-quiet" data-atlas="open">Открыть программу <span aria-hidden="true">→</span></button>'}</div>`;
  }

  function portfolioPanel() {
    const haveVerified = data.portfolioVerified?.total > 0;
    const verified = haveVerified && view.scenarioScope === 'verified';
    const portfolio = verified ? data.portfolioVerified : data.portfolio;
    const scenario = portfolio?.scenarios.find(item=>item.id===view.scenario) ?? portfolio?.scenarios[0];
    if (!portfolio || !scenario) return '';
    const sign = value=>value>0 ? '+'+value : String(value);
    const status = (feasible, group)=>`<span class="portfolio-state ${feasible ? 'portfolio-state--feasible' : ''}">
      <span class="sr-only">${esc(t(group))}: </span><i aria-hidden="true"></i>${esc(t(feasible?'Выполнима':'Требует проверки'))}</span>`;
    return `<header class="portfolio-head"><div><h2 id="portfolio-title">Какие улучшения помогут</h2>
      <p>${esc(t(verified ? 'Рабочие программы' : 'Учебные программы'))} · ${esc(t('Сравниваем один и тот же набор дат и групп.'))}</p></div>
      <div class="portfolio-count"><strong>${portfolio.currentCount}<small> / ${portfolio.total}</small></strong><span>выполнимы сейчас</span></div></header>
      ${haveVerified ? `<div class="portfolio-scope" role="group" aria-label="Набор сравниваемых программ">
        ${option('Учебные','scenarioScope','demo',!verified)}${option('Рабочие','scenarioScope','verified',verified)}</div>` : ''}
      <div class="portfolio-grid"><div class="portfolio-options" role="group" aria-label="Варианты улучшения">${portfolio.scenarios.map(item=>
        `<button type="button" data-atlas="scenario" data-value="${esc(item.id)}" aria-pressed="${item.id===scenario.id}">
          <span>${esc(item.title)}</span><strong><span class="sr-only">${esc(t('Изменение'))}: </span>${sign(item.delta)}</strong></button>`).join('')}</div>
      <div class="portfolio-insight"><div class="portfolio-result"><strong>${scenario.feasibleCount} из ${portfolio.total}</strong><span>программ в этом сценарии</span></div>
        <p>${esc(scenario.description)}</p>
        <details><summary>Результаты по программам</summary>
          <ul class="portfolio-programs">${scenario.programs.map(item=>`<li><span><strong>${esc(item.subtitle)}</strong><small>${esc(item.title)}</small></span>
            <div>${status(item.before,'Сейчас')}<span aria-hidden="true">→</span>${status(item.after,'В сценарии')}</div></li>`).join('')}</ul></details>
      </div></div><p class="portfolio-note">Расчёт отражает выполнимость наблюдаемых программ при указанных условиях. Наличие мест и запуск поездки подтверждает специалист.</p>`;
  }

  function paint(frame) {
    const selected = record();
    const working = Boolean(selected && selected===workingPilot);
    current = actualPlan();
    if (view.day !== 'all' && !current.days[Number(view.day)]) view.day = 'all';
    const displayed = calendarPlan(current, view.day);
    const dayIds = new Set(displayed.days.flatMap(day=>day.stops).map(stop=>stop.id));
    const affectedIds = new Set(selected?.removed?.map(item=>item.id));
    const alternativeIds = new Set(selected?.added?.map(item=>item.id));
    const cities = new Set(displayed.days.map(day=>day.city));
    const official = view.layer==='official';
    const comparing = selected && !official && showSplit(selected);
    const comparison = comparing ? calendarPlan(
      view.variant==='split' && selected.currentPlan ? selected.currentPlan :
        planRoute(data.places,selected.settings,view.variant==='split' ? null : 'suzdal-kremlin'),view.day) : null;
    const comparisonIds = new Set(comparison?.days.flatMap(day=>day.stops.map(stop=>stop.id)) ?? []);
    const query = view.search.trim().toLocaleLowerCase();
    const baseSettings = inspectionSettings(selected);
    const places = data.places.map(place=>{
      const assessment = assess(place,baseSettings,inspectionDay(place));
      return { ...place, coordinates:place.coordinates ?? geodata.places?.[place.id]?.coordinates,
        status:assessment.status, changed:!official && affectedIds.has(place.id) && cities.has(place.city),
        alternative:!official && alternativeIds.has(place.id) && dayIds.has(place.id) };
    }).filter(place=>!selected ? !query || [place.name,place.en,place.cn,place.city,t(place.city)].some(value=>value?.toLocaleLowerCase().includes(query))
      : official ? working ? displayed.days.some(day=>placeFitsDay(place,day)) : cities.has(place.city) :
        view.layer==='all'||dayIds.has(place.id)||comparisonIds.has(place.id)||place.changed||
        (view.layer==='risk'&&place.status!=='ready'&&(working ? displayed.days.some(day=>placeFitsDay(place,day)) : cities.has(place.city))));
    const program = find('#atlas-program');
    const programs = workingPilot ? data.affected.filter(record=>!record.settings.demo) : data.affected;
    program.innerHTML = '<option value="">'+esc(t('Все объекты региона'))+'</option>'+
      (workingPilot ? '<option value="'+workingPilot.id+'"'+(working?' selected':'')+'>'+esc(t('Текущая рабочая проверка'))+'</option>' : '')+programs.map(record=>
      '<option value="'+esc(record.id)+'"'+(record.id===view.group?' selected':'')+'>'+
      esc((record.settings.demo ? t('Учебная программа: {name}',{name:programName(record.title)}) : programName(record.title))+' · '+t(record.subtitle))+'</option>').join('');
    find('#atlas-days').innerHTML = selected ? option('Весь маршрут','day','all',view.day==='all') +
      current.days.map((_,i)=>option(t('День {day}',{day:i+1}),'day',String(i),view.day===String(i))).join('') : '';
    find('#atlas-base').innerHTML = option('Схема','base','scheme',view.base==='scheme') +
      option('Улицы','base','streets',view.base==='streets');
    const fit = find('[data-atlas=fit]');
    const fitLabel = t(official ? 'Показать объекты на карте' : 'Показать маршрут целиком');
    fit.setAttribute('aria-label',fitLabel);
    fit.title = fitLabel;
    find('#atlas-layers').innerHTML = selected ? actions.filter(([id])=>working ? id!=='all' : id!=='official'||data.publishedConditions?.objectCount)
      .map(([id,label])=>option(id==='route'&&current.publishedPreview?'Точки черновика':label,'layer',id,view.layer===id)).join('') : '';
    find('#atlas-legend').hidden = !comparing;
    if (frame!=='search') find('#atlas-inspector').innerHTML = inspector(selected,places);
    if (!selected) {
      find('#atlas-list-count').textContent = t('На карте: {count}',{count:formatNumber(places.filter(place=>place.coordinates).length)});
      find('#atlas-search-list').innerHTML = placeRows(places)||'<p class="empty">'+esc(t('Нет объектов для этого фильтра.'))+'</p>';
    }
    const panel = find('#atlas-portfolio');
    const expanded = panel.querySelector('details')?.open;
    panel.innerHTML = selected && !working ? portfolioPanel() : '';
    panel.hidden = !panel.firstElementChild;
    if (expanded && panel.querySelector('details')) panel.querySelector('details').open = true;
    find('[data-atlas=portfolio]').hidden = panel.hidden;
    map?.update({ places, route:official ? null : displayed, alternative:comparison, selectedId:view.selected,
      changedIds:places.filter(place=>place.changed).map(place=>place.id),
      showPlaces:true, base:view.base, geodata, locale:getLocale(), dayIndex:view.day==='all'?0:Number(view.day),
      frame:frame ? official || view.layer==='all' ? 'places' : 'route' : false });
    if (!map) find('#tour-map').textContent = 'Карта недоступна. Программа и карточки объектов доступны справа.';
    localizeDom(container);
  }

  async function expand() {
    const shell = find('.atlas-map-shell');
    if (document.fullscreenElement) { await document.exitFullscreen?.(); return; }
    if (shell.requestFullscreen) {
      try { await shell.requestFullscreen(); return; }
      catch { /* some embedded browsers disable native full screen */ }
    }
    shell.classList.toggle('atlas-map-shell--expanded');
  }

  function onClick(event) {
    const button = event.target.closest('[data-atlas]');
    if (!button) return;
    const {atlas:action,value} = button.dataset;
    if (action==='fit') {
      map?.fit(view.layer==='official' ? {allPlaces:true} : {routeOnly:true});
      return;
    }
    if (action==='expand') { void expand(); return; }
    if (action==='portfolio') {
      const panel = find('#atlas-portfolio');
      panel.scrollIntoView({block:'start'});
      panel.focus({preventScroll:true});
      return;
    }
    if (action==='open') {
      const selected = record();
      const firstIssue = selected.issues[0];
      const issue = firstIssue ? firstIssue.name + ' · ' + firstIssue.reasons.join(' ') : null;
      onOpenRoute(selected.settings,current,{id:selected.id,issue});
      return;
    }
    if (action==='open-official' && record()) {
      onOpenRoute({...record().settings,demo:false},null,null);
      return;
    }
    if (action==='passport') {
      const place = data.places.find(item=>item.id===value);
      if (place) {
        const day = inspectionDay(place);
        const stop = view.layer==='official' ? null : current.days[day]?.stops.find(item=>item.id===value);
        onOpenPlace(value,inspectionSettings(record()),day,stop,button);
      }
      return;
    }
    if (action==='clear') view.selected=null;
    if (action==='stop') view.selected=value;
    if (['day','layer','base','variant','scenario','scenarioScope'].includes(action)) view[action]=value;
    if (['day','layer'].includes(action)) view.selected=null;
    paint(['group','day','layer'].includes(action));
    if (action==='layer' && ['all','official'].includes(value)) map?.fit({allPlaces:true});
    if (action==='stop') map?.select(view.selected,{focus:true});
    const focused = Array.from(container.querySelectorAll('[data-atlas]')).find(x=>
      x.dataset.atlas===action && x.dataset.value===value);
    focused?.focus({preventScroll:true});
  }
  function onChange(event) {
    if (['map-visit-date','map-group-size'].includes(event.target.id)) {
      if (!event.target.validity.valid || !event.target.value) return;
      if (event.target.id==='map-visit-date') view.date=event.target.value;
      else view.size=Number(event.target.value);
      paint(false);
      find('#'+event.target.id)?.focus({preventScroll:true});
      return;
    }
    if (event.target.id!=='atlas-program') return;
    view.group = event.target.value;
    view.layer = view.group && view.group!==workingPilot?.id ? 'route' : 'official';
    view.day = 'all';
    view.selected = null;
    view.search = '';
    view.variant = 'replacement';
    paint(true);
    find('#atlas-program').focus({preventScroll:true});
  }
  function onInput(event) {
    if (event.target.id!=='map-place-search') return;
    view.search = event.target.value;
    paint('search');
  }
  function onEscape(event) {
    if (event.key==='Escape') find('.atlas-map-shell').classList.remove('atlas-map-shell--expanded');
  }
  container.addEventListener('click',onClick);
  container.addEventListener('change',onChange);
  container.addEventListener('input',onInput);
  document.addEventListener('keydown',onEscape);
  paint(true);
  return {
    context() { return {...view}; },
    update(next) {
      if (data.auditVersion!==next.auditVersion) {
        view.variant='replacement';
        view.selected=next.auditVersion==='2' ? next.affected.find(item=>item.id===view.group)?.removed[0]?.id ?? null : null;
      }
      data=next;
      workingPlan=null;
      paint(false);
    },
    destroy() {
      document.removeEventListener('keydown',onEscape);
      container.removeEventListener('click',onClick);
      container.removeEventListener('change',onChange);
      container.removeEventListener('input',onInput);
      map?.destroy();
    },
  };
}
