import { assess, defaultRoute, kindNames, months, number, planRoute, routeSettings } from '/engine.mjs';

const $ = selector => document.querySelector(selector);
const screen = $('#screen');
const dialog = $('#place-dialog');
const labels = { impact:'Мониторинг', catalog:'Каталог', route:'Маршрут', stats:'Статистика', sources:'Данные и методика' };
const statusText = { ready:'Подходит в демо', blocked:'Ограничение', unknown:'Требует проверки' };
let data;
let options = {...defaultRoute};
let route;
let scenario;
let agent;
let busy = false;
let metric = 'nights';
let filters = {search:'',kind:'all',status:'all'};
let toastTimer;
const safe = value => String(value ?? '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
const chip = (text,type='') => '<span class="chip '+type+'">'+safe(text)+'</span>';
const outbound = (href,label) => '<a href="'+safe(href)+'" target="_blank" rel="noopener noreferrer">'+safe(label)+'</a>';
const page = () => Object.hasOwn(labels,location.hash.slice(1)) ? location.hash.slice(1) : 'impact';
const dateFmt = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Moscow'});
const datetimeFmt = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
const date = text => dateFmt.format(new Date(text));
const timestamp = text => text ? datetimeFmt.format(new Date(text)) : 'ещё не проверен';
const head = (title,subtitle='',action='') => '<header class="page-head"><div><h1>'+safe(title)+'</h1>'+
  (subtitle ? '<p class="muted">'+safe(subtitle)+'</p>' : '')+'</div>'+action+'</header>';
const button = (label,action,quiet=false) => '<button type="button" class="'+(quiet?'button-quiet':'button')+'" data-action="'+action+'">'+safe(label)+'</button>';
const val = v => v===null ? 'нет данных' : typeof v==='number' ? number(v) : Array.isArray(v) ? v.join(', ') : String(v);

async function api(path,body,method=body===undefined ? 'GET' : 'POST') {
  const res = await fetch('/api/'+path,{method,headers:body===undefined ? {} : {'Content-Type':'application/json'},body:body===undefined ? undefined : JSON.stringify(body)});
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Действие не выполнено');
  return result;
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(()=>{ $('#toast').hidden=true; },5500);
}

function routeStatus(record) {
  if (record.affected) return chip('Требует пересмотра','warn');
  return chip('Без изменений');
}

function statisticChart(series) {
  const maximum = Math.max(1,...series.averages.map(month=>month.value ?? 0));
  const lows = new Set(series.lows.map(month=>month.month));
  const columns = series.averages.map(({month,value})=>{
    const height = value===null ? 0 : Math.round(100*value/maximum);
    const tooltip = month+' · '+(value===null ? 'нет данных' : number(value)+' '+series.unit);
    return '<div class="chart-col" title="'+safe(tooltip)+'"><div class="chart-value">'+
      (value===null?'—':number(Math.round(value/1000))+' тыс.')+'</div><div class="bar-base"><div class="chart-bar '+
      (lows.has(month)?'low':'')+'" style="--h:'+height+';width:100%;'+(value===null?'visibility:hidden':'')+'"></div></div><span>'+safe(month.slice(0,3))+'</span></div>';
  }).join('');
  return '<div class="chart" aria-hidden="true">'+columns+'</div><p class="caption">Среднее по месяцам, '+
    safe((series.years.some(y=>y.total!==null) ? series.years.filter(y=>y.total!==null) : series.years).map(y=>y.year).join(', '))+
    '. Тёмным выделены три месяца с наименьшими значениями.</p>'+
    '<details><summary class="link-button">Значения по месяцам</summary><div class="table-wrap"><table><thead><tr><th>Месяц</th>'+
    series.years.map(y=>'<th>'+y.year+'</th>').join('')+'</tr></thead><tbody>'+months.map((month,i)=>'<tr><th scope="row">'+month+'</th>'+
    series.years.map(y=>'<td>'+val(y.monthly[i])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></details>';
}

function monitor() {
  const active = data.affected.filter(x=>x.affected);
  const latest = data.changes[0];
  const row = x => '<li><div class="row"><div><h3>'+safe(x.title)+'</h3><p class="caption">'+safe(x.subtitle)+' · '+x.settings.size+
    ' чел. · '+date(x.settings.date)+'</p></div>'+routeStatus(x)+'</div>'+
    (x.affected ? '<p class="detail">'+safe(x.issues.map(i=>i.name+' · '+i.reasons.join(' ')).join(' ') ||
      (x.shifted.length?'Изменилось время посещения.':'Обновилась программа.'))+'</p>'+
      (x.added.length ? '<p class="detail">Замена: '+safe(x.added.map(stop=>stop.name).join(', '))+'</p>' : '') : '')+
    '<button class="link-button detail" data-track="'+safe(x.id)+'">Открыть программу</button></li>';
  return '<header class="hero"><div><p class="eyebrow">Пилот · Владимирская область</p><h1>Мониторинг туристических маршрутов</h1>'+
    '<p>Проверяйте, как изменения условий посещения влияют на поездки, и сравнивайте варианты корректировки программы.</p></div>'+
    '<div class="hero-summary"><div class="value">'+active.length+' <small>из '+data.affected.length+'</small></div>'+
    '<p>маршрутов требуют пересмотра</p>'+button(data.auditVersion==='1'?'Снизить лимит в демо':'Вернуть исходный лимит','demo')+'</div></header>'+
    '<div class="counts"><div class="count"><strong>'+data.places.length+'</strong><span>объектов в каталоге</span></div>'+
    '<div class="count"><strong>'+data.readyCount+'</strong><span>подходят для группы из 18 человек в демо</span></div>'+
    '<div class="count"><strong>'+data.changes.length+'</strong><span>записей об изменениях</span></div></div>'+
    '<div class="grid"><section class="panel"><div class="section-head"><h2>Маршруты на контроле</h2><a href="#route">Новый маршрут</a></div>'+
    '<ul class="rows">'+data.affected.map(row).join('')+'</ul>'+
    (active.length ? '<div class="callout">Проверьте замены и сценарий с двумя сеансами у группы из Китая. <a href="#route" data-action="scenario-link">Сравнить сценарии</a></div>' : '')+
    '</section><div class="stack"><section class="panel"><div class="section-head"><h2>Последнее изменение</h2><a href="#sources">Журнал</a></div>'+
    (latest ? '<div class="row"><div><h3>'+safe(latest.name)+'</h3><p class="detail">'+safe(latest.field)+' · '+safe(val(latest.before))+' → '+safe(val(latest.after))+
      '</p><p class="caption">'+outbound(latest.url,latest.source)+' · '+timestamp(latest.at)+'</p></div></div>' :
      '<p class="empty">Изменений пока нет. Учебное обновление снизит лимит в Суздальском кремле с 25 до 12 человек.</p>')+
    '</section><section class="panel"><div class="section-head"><h2>Следующие действия</h2></div><ul class="rows">'+data.recommendations.slice(0,3).map(rec=>
      '<li><h3>'+safe(rec.title)+'</h3><p class="detail">'+safe(rec.text)+'</p></li>').join('')+'</ul></section></div></div>';
}

function matchingPlaces() {
  const query = filters.search.toLowerCase().trim();
  return data.places.filter(place=>{
    const result = assess(place,options,place.city==='Суздаль'?1:place.city==='Кидекша'?2:0);
    return (filters.kind==='all'||place.kind===filters.kind) && (filters.status==='all'||result.status===filters.status) &&
      (!query || (place.name+' '+place.city).toLowerCase().includes(query));
  });
}

function selectOption(value,label,selected) {
  return '<option value="'+safe(value)+'"'+(value===selected?' selected':'')+'>'+safe(label)+'</option>';
}

function catalogRows() {
  const matching = matchingPlaces();
  if (!matching.length) return '<tr><td colspan="5"><p class="empty">Подходящих объектов нет.</p></td></tr>';
  return matching.map(place=>{
    const result = assess(place,options,place.city==='Суздаль'?1:place.city==='Кидекша'?2:0);
    return '<tr><td><button class="link-button" data-place="'+safe(place.id)+'">'+safe(place.name)+'</button></td><td>'+safe(place.city)+'</td>'+
      '<td>'+kindNames[place.kind]+'</td><td>'+chip(statusText[result.status],result.status==='blocked'?'error':result.status==='unknown'?'warn':'')+'</td>'+
      '<td>'+outbound(place.url,place.url.includes('wikidata')?'Wikidata':'Страница объекта')+'</td></tr>';
  }).join('');
}

function catalog() {
  return head('Каталог объектов','Группа '+options.size+' чел. · '+date(options.date)+' · '+(options.demo?'Учебные условия':'Условия проверяются по первоисточникам'))+
    '<section class="panel"><div class="filters"><label class="field flex-grow">Поиск<input type="search" id="search" placeholder="Название или город" value="'+safe(filters.search)+
    '"></label><label class="field">Категория<select id="kind">'+Object.entries({all:'Все категории',...kindNames}).map(([v,t])=>selectOption(v,t,filters.kind)).join('')+
    '</select></label><label class="field">Готовность<select id="status">'+Object.entries({all:'Любой статус',...statusText}).map(([v,t])=>selectOption(v,t,filters.status)).join('')+
    '</select></label></div><div class="table-wrap"><table><thead><tr><th>Объект</th><th>Локация</th><th>Категория</th><th>Готовность</th><th>Источник</th></tr></thead>'+
    '<tbody id="catalog-rows">'+catalogRows()+'</tbody></table></div></section>';
}

function placeDetails(id) {
  const place = data.places.find(x=>x.id===id);
  if (!place) return;
  const audit = options.demo ? place.audit : null;
  const result = assess(place,options,place.city==='Суздаль'?1:place.city==='Кидекша'?2:0);
  dialog.innerHTML = '<div class="section-head"><h2 id="place-title">'+safe(place.name)+'</h2>'+button('Закрыть','close',true)+'</div>'+
    '<p class="caption">'+safe(place.city)+' · '+kindNames[place.kind]+'</p><dl class="dialog-fields">'+
    '<dt>Готовность для группы</dt><dd>'+chip(statusText[result.status],result.status==='ready'?'':'warn')+'</dd>'+
    '<dt>Источник сведений об объекте</dt><dd>'+outbound(place.url,place.url.includes('wikidata')?'Wikidata':'Страница объекта')+'</dd>'+
    '<dt>Дата проверки</dt><dd>'+date(place.checkedAt)+'</dd>'+
    (place.coordinates ? '<dt>Координаты</dt><dd>'+outbound(place.wikiLink,place.coordinates.map(x=>x.toFixed(5)).join(', '))+
      '<div class="caption">Wikidata · '+timestamp(place.wikiCheckedAt)+'</div></dd>' : '')+
    (audit ? '<dt>Условия визита</dt><dd>'+outbound('/api/audit-version/'+data.auditVersion,'Учебный аудит, версия '+data.auditVersion)+'</dd>'+
      '<dt>Лимит группы</dt><dd>'+audit.capacity+' чел.</dd><dt>Часы работы</dt><dd>'+audit.hours[0]+':00–'+audit.hours[1]+':00</dd>'+
      '<dt>Продолжительность</dt><dd>'+audit.minutes+' мин.</dd><dt>Под перевод</dt><dd>'+(audit.language==='interpreter'?'Предусмотрено в демо':'Требует подтверждения')+'</dd>' : '')+
    '</dl>'+result.reasons.map(t=>'<p class="detail">'+safe(t)+'</p>').join('');
  dialog.showModal();
}

function renderDay(day,index,localized) {
  return '<section class="route-day"><div class="row"><div><h3>День '+(index+1)+' · '+safe(day.city)+'</h3><p class="caption">'+date(day.date)+'</p></div></div>'+
    '<ul class="rows">'+day.stops.map(stop=>'<li class="timeline"><time>'+stop.start+'–'+stop.end+'</time><div class="label-pair">'+
      (stop.id ? '<button type="button" class="link-button" data-place="'+safe(stop.id)+'">'+safe(stop.name)+'</button>' : '<strong>'+safe(stop.name)+'</strong>')+
      (localized?'<span lang="zh-Hans" class="lang-line">'+safe(stop.cn)+'</span>':'')+
      '<span class="caption">'+(stop.type==='travel'?'Переезд · расчётное время':kindNames[stop.type]+
        (stop.split?' · два сеанса по '+Math.ceil(options.size/2)+' чел.':' · лимит '+stop.capacity+' чел. в демо'))+'</span></div></li>').join('')+
    '</ul>'+(day.missing.length?'<p class="callout">Требуется подтверждение: '+safe(day.missing.join(', '))+'.</p>':'')+'</section>';
}

function scenarioView() {
  if (!scenario) return '';
  const card = (title,plan) => {
    const day = plan.days[1];
    const main = day.stops.filter(x=>x.type==='visit');
    const split = main.find(x=>x.split);
    return '<div class="panel"><h3>'+title+'</h3><p class="caption">Суздаль · '+date(day.date)+'</p><ul class="rows spaced">'+main.map(stop=>
      '<li><strong>'+safe(stop.name)+'</strong><p class="caption">'+stop.start+'–'+stop.end+(stop.split?' · два сеанса':'')+'</p></li>').join('')+
      '</ul><p class="detail">'+(split
        ? 'Музей остаётся в программе. Нужно согласовать два сеанса и ожидание второй подгруппы.'
        : 'Группа посещает объекты по одному сеансу. Для фактической поездки подтвердите бронь.')+'</p>'+
      (day.missing.length ? '<p class="callout">Нужно уточнить: '+safe(day.missing.join(', '))+'.</p>' : '')+'</div>';
  };
  return '<section id="scenario" class="spaced"><div class="section-head"><h2>Что делать после снижения лимита</h2></div><div class="grid grid-even">'+
    card('Заменить объект',scenario.replacement)+card('Разделить группу',scenario.split)+'</div>'+
    '<p class="caption spaced">Расчёт по учебным условиям. Дополнительный сеанс требует согласования с музеем.</p></section>';
}

function routeView() {
  const plan = route ?? planRoute(data.places,options);
  const fromChina = options.market==='zh';
  return head('Планирование маршрута','Владимир · Суздаль · Кидекша')+
    '<div class="route-layout"><form id="route-form" class="panel route-options"><h2>Параметры</h2>'+
    '<label class="field">Дата начала<input name="date" type="date" required value="'+safe(options.date)+'"></label>'+
    '<label class="field">Длительность<select name="days">'+selectOption(2,'2 дня',options.days)+selectOption(3,'3 дня',options.days)+'</select></label>'+
    '<label class="field">Размер группы<input name="size" type="number" min="1" max="100" required value="'+options.size+'"></label>'+
    '<label class="field">Группа<select name="market">'+selectOption('zh','Организованная группа из Китая',options.market)+selectOption('ru','Российская группа',options.market)+'</select></label>'+
    '<label class="field">Интересы<select name="theme">'+selectOption('heritage','История и архитектура',options.theme)+selectOption('museum','Музеи',options.theme)+
    selectOption('any','Все объекты',options.theme)+'</select></label>'+
    '<label class="check"><input type="checkbox" name="access" '+(options.access?'checked':'')+'>Безбарьерный доступ</label>'+
    '<label class="check"><input type="checkbox" name="demo" '+(options.demo?'checked':'')+'>Учебные условия визита</label>'+
    '<button type="submit" class="button">Собрать программу</button></form>'+
    '<div><section class="panel"><div class="section-head"><div><h2>'+safe(plan.days.map(x=>x.city).join(' → '))+'</h2>'+
    '<p class="caption">'+options.days+' дня · '+options.size+' чел.'+(fromChina?' · Группа из Китая':'')+'</p></div>'+
    chip(plan.completeness?'Черновик по учебным данным':'Есть пробелы',plan.completeness?'':'warn')+'</div>'+
    (fromChina ? '<p class="caption">Проверьте запись музеев, сопровождающего переводчика, групповое питание и размещение.</p>' : '')+
    (fromChina&&options.demo ? '<p lang="zh-Hans" class="lang-line">行程草案：请确认中文翻译、团队餐饮、住宿及预订。</p>' : '')+
    plan.days.map((day,i)=>renderDay(day,i,fromChina)).join('')+
    '<div class="actions spaced">'+(plan.completeness ? button('Поставить на мониторинг','track',true) : '')+
    (data.auditVersion==='2'&&options.demo&&options.size>12&&options.size<=24 ? button('Сравнить два сценария','scenario',true) : '')+'</div>'+
    '</section>'+scenarioView()+'</div></div>';
}

function agentView() {
  if (!agent) return '';
  return '<div class="ask-result" aria-live="polite"><h3>'+safe(agent.title)+'</h3><p class="detail">'+safe(agent.text)+'</p>'+
    '<p class="caption status-line">'+safe(agent.plan.mode)+'</p>'+
    (agent.summary ? '<p class="caption">'+outbound(agent.summary.source,'Ряд Roschart')+' · '+outbound(agent.summary.publication,'Первоисточник Росстат')+
      ' · '+safe(agent.summary.edition)+' · Получено '+timestamp(agent.summary.checkedAt)+'</p><p class="caption">'+safe(agent.note)+'</p>'+
      (agent.summary.years.length?statisticChart(agent.summary):'') : '')+
    (agent.view?'<a href="#'+safe(agent.view)+'">Открыть '+(agent.view==='impact'?'мониторинг':'маршрут')+'</a>':'')+'</div>';
}

function stats() {
  const series = data[metric];
  return head('Сезонность размещения','Владимирская область · месячные ряды Росстата',button('Обновить источники','refresh',true))+
    '<div class="grid"><section class="panel"><div class="section-head"><div><h2>'+safe(series.name)+'</h2><p class="caption">Средние по полным календарным годам</p></div>'+
    '<label class="field">Показатель<select id="metric">'+selectOption('nights','Ночёвки',metric)+selectOption('people','Размещённые лица',metric)+'</select></label></div>'+
    statisticChart(series)+'<p class="caption status-line">'+outbound(series.publication,'Росстат')+' · '+outbound(series.source,'Выгрузка через Roschart')+
    ' · '+safe(series.edition)+' · '+timestamp(series.checkedAt)+'</p></section>'+
    '<section class="panel"><h2>Запросить анализ</h2><form id="ask-form" class="ask"><input aria-label="Запрос к агенту" type="text" name="question" required maxlength="600" placeholder="Например, когда меньше ночёвок?"><button type="submit" class="button">Спросить</button></form>'+
    '<button class="link-button sample" data-sample="В какие месяцы меньше всего ночёвок за последние три полных года?">Минимум ночёвок за три года</button><br>'+
    '<button class="link-button sample" data-sample="Какие маршруты затронуло изменение лимита?">Какие маршруты затронуты</button>'+agentView()+'</section></div>';
}

function sources() {
  const known = [['nights','Ночёвки · Росстат через Roschart',data.nights.source],['people','Размещённые лица · Росстат через Roschart',data.people.source],
    ['wiki','Названия и координаты · Wikidata','https://www.wikidata.org/wiki/Wikidata:Data_access']];
  const sourceRows = known.map(([key,name,url])=>{
    const entry = data.sources[key];
    const status = entry?.status==='live' ? chip('Подключён') : entry?.status==='error' ? chip('Последняя копия','warn') : chip('Начальный снимок','plain');
    return '<li><div class="row"><div><h3>'+outbound(url,name)+'</h3><p class="caption">'+timestamp(entry?.checkedAt)+
      (entry?.status==='error'?' · '+safe(entry.message):'')+'</p></div>'+status+'</div></li>';
  });
  return head('Источники и изменения','Автоматическая проверка при запуске и раз в 6 часов работы приложения.',button('Обновить источники','refresh',true))+
    '<div class="grid"><section class="panel"><div class="section-head"><h2>Журнал изменений</h2></div>'+
    (data.changes.length ? '<ul class="rows">'+data.changes.map(change=>'<li><div class="row"><div><h3>'+safe(change.name)+'</h3><p class="detail">'+
      safe(change.field)+' · '+safe(val(change.before))+' → '+safe(val(change.after))+'</p><p class="caption">'+outbound(change.url,change.source)+
      ' · '+timestamp(change.at)+'</p></div>'+(change.demo ? chip('Учебное изменение','warn') : chip('Из внешнего источника'))+'</div></li>').join('')+
      '</ul>' : '<p class="empty">Изменений не зафиксировано.</p>')+'</section>'+
    '<section class="panel"><div class="section-head"><h2>Подключения</h2></div><ul class="rows">'+sourceRows.join('')+
    '<li><h3>'+outbound('/api/audit-version/'+data.auditVersion,'Учебный аудит · версия '+data.auditVersion)+'</h3><p class="caption">Сценарные лимиты, режим работы и условия для групп.</p></li>'+
    '<li><h3>Материалы МАГ</h3><p class="caption">Методология и сверка. Каталог обогащается опубликованными данными объектов и Wikidata.</p></li></ul></section></div>';
}

function render(scroll=false) {
  if (!data) return;
  const current = page();
  document.title = labels[current]+' — ТурКонтур';
  document.querySelectorAll('nav a').forEach(a=>{
    if (a.hash==='#'+current) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  screen.innerHTML = {impact:monitor,catalog,route:routeView,stats,sources}[current]();
  if (scroll) {
    window.scrollTo(0,0);
    $('#content').focus({preventScroll:true});
  }
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
    access:f.has('access'),demo:f.has('demo')});
}

screen.addEventListener('submit',event=>{
  event.preventDefault();
  const form = event.target;
  const button = form.querySelector('[type=submit]');
  if (form.id==='route-form') runAction(async()=>{
    options = readOptions(form);
    route = await api('route',options);
    scenario = null;
    render();
  },button);
  if (form.id==='ask-form') runAction(async()=>{
    const input = form.elements.question;
    button.textContent = 'Анализ…';
    try {
      agent = await api('ask',{question:input.value,settings:options});
      const question = input.value;
      render();
      $('#ask-form').elements.question.value = question;
    } finally { button.textContent = 'Спросить'; }
  },button);
});

async function showScenario() {
  scenario = await api('scenario',options);
  render();
  $('#scenario').scrollIntoView({block:'start'});
}

screen.addEventListener('click',event=>{
  const target = event.target.closest('[data-action],[data-place],[data-track],[data-sample]');
  if (!target) return;
  if (target.dataset.place) placeDetails(target.dataset.place);
  if (target.dataset.track) {
    const record = data.affected.find(x=>x.id===target.dataset.track);
    options = record.settings;
    route = null;
    scenario = null;
    location.hash = 'route';
  }
  if (target.dataset.sample) {
    const form = $('#ask-form');
    form.elements.question.value = target.dataset.sample;
    form.requestSubmit();
  }
  if (target.dataset.action==='refresh') runAction(async()=>{
    target.textContent = 'Проверяем источники…';
    try {
      data = await api('refresh',{});
      const ok = Object.values(data.sources).filter(source=>source.status==='live').length;
      toast('Источники обновлены: '+ok+' из 3.');
      render();
    } finally { target.textContent = 'Обновить источники'; }
  },target);
  if (target.dataset.action==='demo') runAction(async()=>{
    data = await api('audit',{version:data.auditVersion==='1'?'2':'1'});
    route = null;
    scenario = null;
    toast(data.auditVersion==='2'?'Лимит обновлён. Программы пересчитаны.':'Восстановлены исходные учебные условия.');
    render();
  },target);
  if (target.dataset.action==='track') runAction(async()=>{
    data = await api('track',options);
    toast('Маршрут поставлен на мониторинг.');
    render();
  },target);
  if (target.dataset.action==='scenario') runAction(showScenario,target);
  if (target.dataset.action==='scenario-link') {
    event.preventDefault();
    options = {...defaultRoute};
    route = null;
    location.hash = 'route';
    runAction(showScenario);
  }
});

screen.addEventListener('input',event=>{
  if (event.target.id==='search') {
    filters.search = event.target.value;
    $('#catalog-rows').innerHTML = catalogRows();
  }
});
screen.addEventListener('change',event=>{
  const input = event.target;
  if (input.id==='kind'||input.id==='status') {
    filters[input.id] = input.value;
    $('#catalog-rows').innerHTML = catalogRows();
  }
  if (input.id==='metric') {
    metric = input.value;
    render();
    $('#metric').focus();
  }
});
dialog.addEventListener('click',event=>{
  if (event.target===dialog||event.target.closest('[data-action=close]')) dialog.close();
});
window.addEventListener('hashchange',()=>render(true));

try {
  data = await api('state');
  render();
  if (!data.refreshedAt) setTimeout(async()=>{
    if (!busy && !dialog.open && !screen.contains(document.activeElement)) {
      try { data = await api('state'); render(); } catch { /* last rendered state remains usable */ }
    }
  },8000);
} catch(error) {
  screen.innerHTML = '<p role="alert">'+safe(error.message)+'</p>';
} finally { screen.setAttribute('aria-busy','false'); }
