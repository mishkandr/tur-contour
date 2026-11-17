import { assess, kindNames, number, planRoute } from '/engine.mjs';
import { createRouteMap } from '/map.js';

const dateLabel = new Intl.DateTimeFormat('ru-RU', { day:'numeric', month:'long', timeZone:'Europe/Moscow' });
const pictureSource = 'https://commons.wikimedia.org/wiki/File:Suzdal_asv2019-01_img40_Kremlin_view.jpg';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const dayDate = value => dateLabel.format(new Date(value));
const actions = [
  ['route','Точки маршрута'],
  ['all','Все объекты'],
  ['risk','Ограничения'],
];
const statusTitles = { ready:'Подходит в демо', blocked:'Есть ограничение', unknown:'Нужна проверка' };

function option(label, action, value, active, disabled = false) {
  return '<button type="button" class="atlas-option" data-atlas="'+action+'" data-value="'+esc(value)+
    '" aria-pressed="'+active+'"'+(disabled?' disabled':'')+'>'+esc(label)+'</button>';
}

function stopCount(plan) {
  return plan.days.flatMap(day=>day.stops).filter(stop=>stop.id).length;
}

function calendarPlan(plan, selectedDay) {
  return selectedDay === 'all' ? plan : { ...plan, days:plan.days.filter((_, i)=>String(i)===selectedDay) };
}

export function mountAtlas(container, initialData, geodata, { onOpenRoute }) {
  const view = {
    group:initialData.affected[0]?.id, day:'all', layer:'route', base:'streets', selected:null, variant:'replacement',
  };
  let data = initialData;
  let current;
  container.innerHTML = `
    <div class="atlas-heading">
      <div><p class="atlas-context"><i></i> Владимирская область</p><h1>Карта маршрутов</h1>
      <p class="atlas-intro">Проверьте готовность поездок и сравните, как изменения влияют на программу.</p></div>
      <div class="atlas-heading-actions"><a class="button-quiet" href="#sources">Журнал изменений<span aria-hidden="true"> ↗</span></a>
      <button class="button atlas-demo" type="button" data-action="demo"><span aria-hidden="true">↻</span> <span id="atlas-demo-label"></span></button></div>
    </div>
    <div class="atlas-workspace">
      <section class="atlas-map-shell" aria-label="Карта объектов и остановок">
        <div class="atlas-map-top"><div><span class="atlas-map-label">Владимир · Суздаль · Кидекша</span></div>
          <div class="atlas-options atlas-days" id="atlas-days" aria-label="Дни маршрута"></div>
        </div>
        <div class="atlas-map-scene">
          <div id="tour-map" role="region" aria-label="Интерактивная карта Владимирской области"></div>
          <div class="atlas-map-tools" aria-label="Управление картой">
            <div class="atlas-base" id="atlas-base"></div>
            <button type="button" class="atlas-icon" data-atlas="fit" aria-label="Показать маршрут целиком" title="Показать маршрут целиком">⌖</button>
            <button type="button" class="atlas-icon" data-atlas="expand" aria-label="Развернуть карту" title="Развернуть карту">⛶</button>
          </div>
        </div>
        <div class="atlas-map-bottom">
          <div class="atlas-options atlas-layers" id="atlas-layers" aria-label="Объекты на карте"></div>
          <span class="atlas-legend" id="atlas-legend" hidden><i></i> Другой вариант</span>
          <span id="atlas-map-note" class="atlas-map-note" aria-live="polite">Схема поездки</span>
        </div>
      </section>
      <section class="atlas-inspector" id="atlas-inspector" aria-label="Выбранная программа"></section>
    </div>
    <div class="atlas-summary" id="atlas-summary"></div>
    <section class="panel atlas-recommendations" id="atlas-recommendations"></section>
  `;
  const find = selector => container.querySelector(selector);
  const map = createRouteMap(find('#tour-map'), {
    onSelect(id) {
      view.selected = id;
      paint(false);
      if (window.matchMedia('(max-width: 700px)').matches) find('#atlas-inspector').scrollIntoView({block:'nearest'});
    },
    onStatus(status) {
      const state = typeof status === 'string' ? status : status.tiles ?? status.status;
      find('#atlas-map-note').textContent = view.base==='scheme' ? 'Схема поездки'
        : state==='fallback' ? 'Улицы недоступны · схема поездки' : state==='loading' ? 'Загружаем улицы…' : 'Карта улиц';
    },
  });

  function record() {
    return data.affected.find(item=>item.id===view.group) ?? data.affected[0];
  }

  function actualPlan() {
    const selected = record();
    const splitId = data.auditVersion === '2' && selected.affected && view.variant === 'split' ? 'suzdal-kremlin' : null;
    return planRoute(data.places, selected.settings, splitId);
  }

  function details(place, planRecord) {
    const dayOffset = Math.max(0,current.days.findIndex(day=>day.city===place.city));
    const audit = planRecord.settings.demo ? place.audit : null;
    const routeStop = current.days.flatMap(day=>day.stops).find(stop=>stop.id===place.id);
    const state = assess(place, routeStop?.split ? {...planRecord.settings,size:Math.ceil(planRecord.settings.size/2)} : planRecord.settings, dayOffset);
    const changed = planRecord.removed.some(stop=>stop.id===place.id);
    const changedLimit = changed && place.audit?.capacity!==undefined && planRecord.settings.size>place.audit.capacity;
    const source = esc(place.url);
    const point = geodata.places?.[place.id];
    return `
      <div class="atlas-detail">
        <div class="atlas-detail-head">
          <p class="atlas-overline">${esc(place.city)} · ${esc(kindNames[place.kind])}</p>
          <button type="button" class="atlas-x" aria-label="Закрыть карточку точки" data-atlas="clear">×</button>
        </div>
        <h3>${esc(place.name)}</h3>
        ${planRecord.settings.market==='zh' ? '<p lang="zh-Hans" class="atlas-chinese">'+esc(place.cn)+'</p>' : ''}
        <span class="atlas-status atlas-status--${state.status}"><i></i>${routeStop?.split ? 'В программе двумя сеансами' : statusTitles[state.status]}</span>
        ${audit ? `<div class="atlas-facts"><div><span>Лимит в демо</span><strong>${audit.capacity} чел.</strong></div>
          <div><span>Группа</span><strong>${planRecord.settings.size} чел.</strong></div></div>` : ''}
        ${routeStop ? '<p class="atlas-slot">'+esc(routeStop.start)+'–'+esc(routeStop.end)+(routeStop.split?' · два сеанса':' · в программе')+'</p>' : ''}
        ${changedLimit&&!routeStop?.split ? '<p class="atlas-reason">Лимит изменился. Выберите замену или проверьте, помещаются ли два сеанса в расписание.</p>' :
          state.reasons.map(reason=>'<p class="atlas-reason">'+esc(reason)+'</p>').join('')}
        <div class="atlas-detail-links"><a href="${source}" target="_blank" rel="noopener noreferrer">Первоисточник ↗</a>
          <button type="button" class="link-button" data-place="${esc(place.id)}">Паспорт объекта</button>
          ${point?.source ? '<a href="'+esc(point.source)+'" target="_blank" rel="noopener noreferrer">Координаты ↗</a>' : ''}
        </div>
      </div>`;
  }

  function stops(plan, offset) {
    const seen = new Set();
    return plan.days.flatMap((day, index)=>day.stops
      .filter(stop=>stop.id && !seen.has(stop.id) && seen.add(stop.id))
      .slice(0,2)
      .map(stop=>'<button type="button" class="atlas-stop" data-atlas="stop" data-value="'+esc(stop.id)+'"><span class="atlas-stop-day">День '+
        (index+offset+1)+'</span><span>'+esc(stop.name)+'</span><span aria-hidden="true" class="atlas-arr">›</span></button>')).join('');
  }

  function inspector(selected) {
    const point = data.places.find(place=>place.id===view.selected);
    const affected = selected.affected;
    const splitAvailable = data.auditVersion === '2' && affected && selected.removed.some(stop=>stop.id==='suzdal-kremlin');
    const hasSplit = current.days.flatMap(day=>day.stops).some(stop=>stop.split);
    const plan = calendarPlan(current,view.day);
    const alert = data.changes.find(change=>change.demo && change.id==='suzdal-kremlin');
    return `
      <header class="atlas-inspector-head"><p class="atlas-overline">Маршрут под наблюдением</p>
        <h2>${esc(selected.title)}</h2>
        <p class="atlas-date">${dayDate(selected.settings.date)} · ${selected.settings.days} дня</p>
        <div class="atlas-options atlas-groups" aria-label="Выбрать группу">${data.affected.map(item=>
          option(item.subtitle+' · '+item.settings.size,'group',item.id,item.id===selected.id)).join('')}</div>
      </header>
      ${splitAvailable ? `<div class="atlas-impact">
        <div class="atlas-impact-title"><span class="atlas-impact-icon" aria-hidden="true">!</span><strong>Суздальский кремль</strong></div>
        <p>Лимит в демо <strong>${alert?.before ?? 25} → ${alert?.after ?? 12} чел.</strong></p>
        <div class="atlas-options" aria-label="Варианты корректировки">
          ${option('Замена объекта','variant','replacement',view.variant==='replacement')}
          ${option('Два сеанса','variant','split',view.variant==='split')}
        </div>
        <p class="atlas-variant-note">${view.variant==='split'
          ? hasSplit ? 'Кремль остаётся в программе. Два сеанса нужно согласовать с музеем.' : 'Два сеанса не помещаются в расписание по учебным условиям.'
          : selected.added.length ? 'В программу добавлен '+esc(selected.added[0].name)+'.' : 'Нужна подтверждённая замена.'}</p>
      </div>` : ''}
      ${point ? details(point,selected) : !affected ? `
        <figure class="atlas-photo"><img src="/assets/suzdal.jpg" alt="Суздальский кремль со стороны реки Каменки, зимой" width="960" height="480">
          <figcaption><a href="${pictureSource}" target="_blank" rel="noopener noreferrer">А. Савин, Википедия ↗</a></figcaption></figure>` : ''}
      <div class="atlas-stops">
        <div class="atlas-stops-head"><h3>Точки программы</h3><span>${stopCount(plan)} в плане</span></div>
        ${stops(plan, view.day==='all'?0:Number(view.day)) || '<p class="atlas-reason">Пока нет точек на выбранный день.</p>'}
      </div>
      <div class="atlas-inspector-foot"><button type="button" class="button-quiet" data-atlas="open">Открыть программу <span aria-hidden="true">→</span></button></div>`;
  }

  function summary() {
    const affected = data.affected.filter(item=>item.affected).length;
    const latest = data.changes[0];
    const low = data.nights.lows[0];
    return `
      <article><span class="atlas-summary-label">Требуют пересмотра</span><div class="atlas-summary-value">${affected}<small> из ${data.affected.length}</small></div>
        <span>Маршруты под наблюдением</span></article>
      <article><span class="atlas-summary-label">Последнее изменение</span><div class="atlas-summary-value atlas-summary-text">${latest ? esc(latest.name) : 'Изменений пока нет'}</div>
        ${latest ? '<span>'+esc(latest.field)+' · '+esc(latest.before)+' → '+esc(latest.after)+'</span>' : '<span>Запустите учебное обновление</span>'}</article>
      <article><span class="atlas-summary-label">Минимум ночёвок</span><div class="atlas-summary-value atlas-summary-text">${low?esc(low.month[0].toUpperCase()+low.month.slice(1)):'Нет данных'}</div>
        ${low?'<a href="#stats">'+number(low.value)+' в среднем за месяц ↗</a>':'<a href="#stats">Открыть статистику</a>'}</article>`;
  }

  function paint(frame) {
    const selected = record();
    current = actualPlan();
    if (view.day !== 'all' && !current.days[Number(view.day)]) view.day = 'all';
    const displayed = calendarPlan(current, view.day);
    const dayIds = new Set(displayed.days.flatMap(day=>day.stops).map(stop=>stop.id));
    const affectedIds = new Set(selected.removed.map(item=>item.id));
    const alternativeIds = new Set(selected.added.map(item=>item.id));
    const cities = new Set(displayed.days.map(day=>day.city));
    const comparing = data.auditVersion === '2' && affectedIds.has('suzdal-kremlin');
    const comparison = comparing ? calendarPlan(
      planRoute(data.places,selected.settings,view.variant==='split' ? null : 'suzdal-kremlin'),view.day) : null;
    const comparisonIds = new Set(comparison?.days.flatMap(day=>day.stops.map(stop=>stop.id)) ?? []);
    const places = data.places.map(place=>{
      const closestDay = current.days.findIndex(day=>day.city===place.city);
      const assessment = assess(place,selected.settings,Math.max(closestDay,0));
      return { ...place, coordinates:place.coordinates ?? geodata.places?.[place.id]?.coordinates,
        status:assessment.status, changed:affectedIds.has(place.id) && cities.has(place.city),
        alternative:alternativeIds.has(place.id) && dayIds.has(place.id) };
    }).filter(place=>view.layer==='all'||dayIds.has(place.id)||comparisonIds.has(place.id)||place.changed||
      (view.layer==='risk'&&place.status!=='ready'&&cities.has(place.city)));
    find('#atlas-demo-label').textContent = data.auditVersion==='1' ? 'Снизить лимит в демо' : 'Вернуть исходный лимит';
    find('#atlas-days').innerHTML = option('Весь маршрут','day','all',view.day==='all') +
      current.days.map((_,i)=>option('День '+(i+1),'day',String(i),view.day===String(i))).join('');
    find('#atlas-base').innerHTML = option('Схема','base','scheme',view.base==='scheme') +
      option('Улицы','base','streets',view.base==='streets');
    find('#atlas-layers').innerHTML = actions.map(([id,label])=>option(label,'layer',id,view.layer===id)).join('');
    find('#atlas-legend').hidden = !comparing;
    find('#atlas-inspector').innerHTML = inspector(selected);
    find('#atlas-summary').innerHTML = summary();
    find('#atlas-recommendations').innerHTML = '<div class="section-head"><h2>Следующие действия</h2><a href="#sources">Данные и методика ↗</a></div>'+
      '<ul class="rows">'+data.recommendations.slice(0,3).map(rec=>'<li><h3>'+esc(rec.title)+'</h3><p class="detail">'+esc(rec.text)+'</p></li>').join('')+'</ul>';
    map?.update({ places, route:displayed, alternative:comparison, selectedId:view.selected,
      changedIds:places.filter(place=>place.changed).map(place=>place.id),
      showPlaces:true, base:view.base, geodata, frame:frame&&view.day!=='all' ? 'route' : frame });
    if (!map) find('#tour-map').textContent = 'Карта недоступна. Программа и карточки объектов доступны справа.';
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
    if (action==='fit') { map?.fit({routeOnly:true}); return; }
    if (action==='expand') { void expand(); return; }
    if (action==='open') { onOpenRoute(record().settings,current); return; }
    if (action==='group' && value===view.group) return;
    if (action==='clear') view.selected=null;
    if (action==='stop') view.selected=value;
    if (action==='group') {
      view.group=value;
      view.day='all';
      view.selected=null;
      view.variant='replacement';
    }
    if (['day','layer','base','variant'].includes(action)) view[action]=value;
    if (action==='day') view.selected=null;
    paint(['group','day','layer'].includes(action));
    if (action==='layer' && value==='all') map?.fit({allPlaces:true});
    if (action==='stop') map?.select(view.selected,{focus:true});
    const focused = Array.from(container.querySelectorAll('[data-atlas]')).find(x=>
      x.dataset.atlas===action && x.dataset.value===value);
    focused?.focus({preventScroll:true});
  }
  function onEscape(event) {
    if (event.key==='Escape') find('.atlas-map-shell').classList.remove('atlas-map-shell--expanded');
  }
  container.addEventListener('click',onClick);
  document.addEventListener('keydown',onEscape);
  paint(true);
  return {
    update(next) {
      if (data.auditVersion!==next.auditVersion) {
        view.variant='replacement';
        view.selected=next.auditVersion==='2' ? next.affected.find(item=>item.id===view.group)?.removed[0]?.id ?? null : null;
      }
      data=next;
      paint(false);
    },
    destroy() {
      document.removeEventListener('keydown',onEscape);
      container.removeEventListener('click',onClick);
      map?.destroy();
    },
  };
}
