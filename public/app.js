import { mountAtlas } from '/atlas.js';
import { assess, clockTime, defaultRoute, kindNames, months, number, planRoute, publishedHours, routeSettings } from '/engine.mjs';
import { chineseItinerary, chineseItineraryText } from '/chinese-itinerary.mjs';

const $ = selector => document.querySelector(selector);
const screen = $('#screen');
const dialog = $('#place-dialog');
const labels = { impact:'Карта маршрутов', catalog:'Каталог', route:'Маршрут', stats:'Статистика', sources:'Данные и методика' };
const statusText = { ready:'Подходит по условиям', blocked:'Ограничение', unknown:'Требует проверки' };
const routeThemes = {
  heritage:'История и архитектура', museum:'Музеи', romantic:'Романтическая поездка', family:'Семейная поездка',
  hike:'Пеший маршрут', nature:'Природа', any:'Любой формат',
};
let data;
let geodata = {};
let atlas;
let options = {...defaultRoute};
let review = newReview();
let agent;
let busy = false;
let metric = 'nights';
let offerSearch = {date:defaultRoute.date,occupancy:2,result:null};
let filters = {search:'',kind:'all',status:'all',date:''};
let toastTimer;
const safe = value => String(value ?? '').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
const chip = (text,type='') => '<span class="chip '+type+'">'+safe(text)+'</span>';
const outbound = (href,label) => '<a href="'+safe(href)+'" target="_blank" rel="noopener noreferrer">'+safe(label)+'</a>';
const page = () => Object.hasOwn(labels,location.hash.slice(1)) ? location.hash.slice(1) : 'impact';
const dateFmt = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Moscow'});
const datetimeFmt = new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'});
const date = text => dateFmt.format(new Date(text));
const timestamp = text => text ? datetimeFmt.format(new Date(text)) : 'ещё не проверен';
const sameSettings = (a,b) => Object.keys(defaultRoute).every(key=>a[key]===b[key]);
const head = (title,subtitle='',action='') => '<header class="page-head"><div><h1>'+safe(title)+'</h1>'+
  (subtitle ? '<p class="muted">'+safe(subtitle)+'</p>' : '')+'</div>'+action+'</header>';
const button = (label,action,quiet=false) => '<button type="button" class="'+(quiet?'button-quiet':'button')+'" data-action="'+action+'">'+safe(label)+'</button>';
const val = v => v===null ? 'нет данных' : typeof v==='number' ? number(v) : Array.isArray(v) ? v.join(', ') : String(v);
const placeDay = place => place.city==='Суздаль' ? 1 : place.city==='Кидекша' ? 2 : 0;
const catalogSettings = () => ({...options,date:filters.date || options.date,demo:false});

function visitDate(start, day) {
  const value = new Date(start+'T12:00:00Z');
  value.setUTCDate(value.getUTCDate()+day);
  return date(value);
}

function openingLabel(official) {
  if (!official) return 'График не найден';
  if (!official.windows) return 'График не покрывает дату';
  if (!official.windows.length) return 'Закрыто по графику';
  return official.windows.map(([open,close])=>clockTime(open)+'–'+clockTime(close)).join(', ');
}

async function api(path,body,method=body===undefined ? 'GET' : 'POST') {
  const res = await fetch('/api/'+path,{method,headers:body===undefined ? {} : {'Content-Type':'application/json'},body:body===undefined ? undefined : JSON.stringify(body)});
  const result = await res.json();
  if (!res.ok) throw Object.assign(new Error(result.error || 'Действие не выполнено'), { status:res.status });
  return result;
}

function newReview(preview = null, program = null) {
  return { preview, program, variants:null, selectedId:null, loading:false, error:'', brief:'', analysis:null,
    aiLoading:false, dirty:false, approval:null };
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(()=>{ $('#toast').hidden=true; },5500);
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

function matchingPlaces(settings) {
  const query = filters.search.toLowerCase().trim();
  return data.places.filter(place=>{
    const result = assess(place,settings,placeDay(place));
    return (filters.kind==='all'||place.kind===filters.kind) && (filters.status==='all'||result.status===filters.status) &&
      (!query || (place.name+' '+place.city).toLowerCase().includes(query));
  });
}

function selectOption(value,label,selected) {
  return '<option value="'+safe(value)+'"'+(value===selected?' selected':'')+'>'+safe(label)+'</option>';
}

function catalogRows() {
  const settings = catalogSettings();
  const matching = matchingPlaces(settings);
  if (!matching.length) return '<tr><td colspan="6"><p class="empty">Подходящих объектов нет.</p></td></tr>';
  return matching.map(place=>{
    const offset = placeDay(place);
    const result = assess(place,settings,offset);
    const evidence = place.publishedConditions;
    const hours = publishedHours(place,settings.date,offset);
    const source = evidence?.schedule?.url ?? evidence?.booking?.url ?? evidence?.notes?.[0]?.url;
    return '<tr><td><button class="link-button" data-place="'+safe(place.id)+'">'+safe(place.name)+'</button></td><td>'+safe(place.city)+
      '<div class="caption">'+visitDate(settings.date,offset)+'</div></td>'+
      '<td>'+safe(openingLabel(hours))+(hours?.label ? '<div class="caption">'+safe(hours.label)+'</div>' : '')+'</td>'+
      '<td>'+kindNames[place.kind]+'</td><td>'+chip(statusText[result.status],result.status==='blocked'?'error':result.status==='unknown'?'warn':'')+'</td>'+
      '<td>'+outbound(source ?? place.url,source ? 'Условия визита' : place.url.includes('wikidata')?'Wikidata':'Страница объекта')+'</td></tr>';
  }).join('');
}

function catalog() {
  return head('Каталог объектов','Опубликованные условия для группы из '+options.size+' чел. · Владимир, Суздаль и Кидекша в последовательные дни')+
    '<section class="panel"><div class="filters"><label class="field">Дата начала<input id="catalog-date" type="date" required value="'+safe(catalogSettings().date)+'"></label>'+
    '<label class="field flex-grow">Поиск<input type="search" id="search" placeholder="Название или город" value="'+safe(filters.search)+
    '"></label><label class="field">Категория<select id="kind">'+Object.entries({all:'Все категории',...kindNames}).map(([v,t])=>selectOption(v,t,filters.kind)).join('')+
    '</select></label><label class="field">Готовность<select id="status">'+Object.entries({all:'Любой статус',...statusText}).map(([v,t])=>selectOption(v,t,filters.status)).join('')+
    '</select></label></div><div class="table-wrap catalog-table"><table><thead><tr><th>Объект</th><th>Место и дата</th><th>Опубликованный график</th><th>Категория</th><th>Готовность</th><th>Источник</th></tr></thead>'+
    '<tbody id="catalog-rows">'+catalogRows()+'</tbody></table></div></section>';
}

function officialEvidence(place,settings,offset) {
  const evidence = place.publishedConditions;
  const title = '<h3>Опубликованные условия</h3>';
  const officialDate = visitDate(settings.date,offset);
  const result = assess(place,{...settings,demo:false},offset);
  const summary = '<div class="official-evidence-head"><div>'+title+'<p class="caption">'+officialDate+
    ' · группа '+settings.size+' чел.</p></div>'+chip(statusText[result.status],result.status==='blocked'?'error':result.status==='unknown'?'warn':'')+'</div>';
  if (!evidence) return '<section class="official-evidence">'+summary+
    '<p class="detail">В собранных источниках нет условий визита. Уточните часы, запись и допустимый размер группы у объекта.</p></section>';
  const hours = publishedHours(place,settings.date,offset);
  const lastEntry = hours?.windows?.length && hours.lastEntryMinutes ?
    '<p class="caption">Последний вход '+hours.windows.map(([,close])=>clockTime(close-hours.lastEntryMinutes)).join(', ')+'</p>' : '';
  const period = hours?.validFrom || hours?.validUntil ? '<p class="caption">Период действия'+
    (hours.validFrom ? ' с '+date(hours.validFrom) : '')+(hours.validUntil ? ' по '+date(hours.validUntil) : '')+'</p>' : '';
  const facts = items=>items.map(item=>'<li><p>'+safe(item.text)+'</p>'+outbound(item.url,'Источник')+'</li>').join('');
  const questions = [...new Set([...(evidence.clarify ?? []),...(result.status==='unknown' ? result.reasons : [])])];
  return '<section class="official-evidence">'+summary+
    (result.status==='blocked' ? '<p class="detail">'+safe(result.reasons.join(' '))+'</p>' : '')+
    (questions.length ? '<div class="callout"><strong>Уточнить у объекта</strong><ul class="official-questions">'+
      questions.map(question=>'<li>'+safe(question)+'</li>').join('')+'</ul></div>' : '')+
    '<dl class="official-facts"><dt>График'+(hours?.label?' · '+safe(hours.label):'')+'</dt><dd><strong>'+safe(openingLabel(hours))+'</strong>'+
    (hours ? lastEntry+period+(hours.note?'<p class="detail">'+safe(hours.note)+'</p>':'')+
      outbound(hours.url,'Опубликованный график') : '')+'</dd>'+
    (evidence.booking ? '<dt>Правила записи</dt><dd><p>'+safe(evidence.booking.text)+'</p>'+outbound(evidence.booking.url,'Источник')+'</dd>' : '')+
    (evidence.limits?.length ? '<dt>Лимиты отдельных посещений</dt><dd><ul class="official-links">'+facts(evidence.limits)+'</ul></dd>' : '')+
    (evidence.notes?.length ? '<dt>Другие сведения</dt><dd><ul class="official-links">'+facts(evidence.notes)+'</ul></dd>' : '')+
    '</dl><p class="caption">Сверено с опубликованными источниками '+date(evidence.checkedAt)+' · Наличие мест на дату визита проверяется отдельно.</p></section>';
}

function placeDetails(id,decisionId,requestedDay,requestedSettings) {
  const place = data.places.find(x=>x.id===id);
  if (!place) return;
  const decision = data.decisions?.find(item=>item.id===decisionId);
  const settings = decision?.settings ?? requestedSettings ?? (page()==='catalog' ? catalogSettings() : options);
  const audit = settings.demo ? place.audit : place.verifiedAudit;
  const plan = decision?.plan ?? (page()==='route' ? selectedVariant()?.plan ?? review.preview : null);
  const day = plan?.days.findIndex(segment=>segment.stops.some(stop=>stop.id===id));
  const stop = day>=0 ? plan.days[day].stops.find(item=>item.id===id) : null;
  const offset = Number.isInteger(requestedDay) ? requestedDay : day>=0 ? day : placeDay(place);
  const requirements = stop?.split ? {...settings,size:Math.ceil(settings.size/2)} : settings;
  const result = assess(place,requirements,offset);
  dialog.innerHTML = '<div class="section-head"><h2 id="place-title">'+safe(place.name)+'</h2>'+button('Закрыть','close',true)+'</div>'+
    '<p class="caption">'+safe(place.city)+' · '+kindNames[place.kind]+'</p>'+officialEvidence(place,settings,offset)+'<dl class="dialog-fields">'+
    '<dt>Источник сведений об объекте</dt><dd>'+outbound(place.url,place.url.includes('wikidata')?'Wikidata':'Страница объекта')+'</dd>'+
    '<dt>Дата проверки</dt><dd>'+date(place.checkedAt)+'</dd>'+
    (place.coordinates ? '<dt>Координаты</dt><dd>'+outbound(place.wikiLink,place.coordinates.map(x=>x.toFixed(5)).join(', '))+
      '<div class="caption">Wikidata · '+timestamp(place.wikiCheckedAt)+'</div></dd>' : '')+
    (audit ? '<dt>'+(settings.demo?'Учебный режим':'Экспертное подтверждение')+'</dt><dd>'+(settings.demo ? outbound('/api/audit-version/'+data.auditVersion,'Учебный аудит, версия '+data.auditVersion)+' · '+chip(statusText[result.status],result.status==='ready'?'':'warn') :
      outbound(audit.sourceUrl,'Источник подтверждённых условий'))+'</dd>'+
      (audit.verifiedAt ? '<dt>Проверено</dt><dd>'+date(audit.verifiedAt)+'</dd>' : '')+
      (audit.validUntil ? '<dt>Действует до</dt><dd>'+date(audit.validUntil)+'</dd>' : '')+
      (audit.booking ? '<dt>Запись</dt><dd>'+(audit.booking==='reservation'?'Нужно бронирование':'Предварительная запись не требуется')+'</dd>' : '')+
      '<dt>Лимит группы</dt><dd>'+safe(audit.capacity)+' чел.</dd><dt>Часы работы</dt><dd>'+safe(audit.hours?.[0])+':00–'+safe(audit.hours?.[1])+':00</dd>'+
      '<dt>Продолжительность</dt><dd>'+safe(audit.minutes)+' мин.</dd><dt>Под перевод</dt><dd>'+
      (audit.language==='interpreter'?(settings.demo?'Предусмотрено в демо':'Подтверждено источником'):'Требует подтверждения')+'</dd>' : '')+
    '</dl>'+(settings.demo && audit ? result.reasons.map(t=>'<p class="detail">'+safe(t)+'</p>').join('') : '');
  if (stop?.split) dialog.insertAdjacentHTML('beforeend','<p class="callout">Проверка для двух подгрупп. Согласуйте оба сеанса с музеем.</p>');
  dialog.showModal();
}

function renderDay(day,index,settings,decisionId) {
  const reference = decisionId ? ' data-decision="'+safe(decisionId)+'"' : '';
  return '<section class="route-day"><div class="route-day-head"><p class="caption">День '+(index+1)+' · '+date(day.date)+'</p><h3>'+safe(day.city)+'</h3></div>'+
    '<ul class="rows">'+day.stops.map(stop=>'<li class="timeline"><time>'+safe(stop.start)+'–'+safe(stop.end)+'</time><div class="label-pair">'+
      (stop.id ? '<button type="button" class="link-button" data-place="'+safe(stop.id)+'"'+reference+'>'+safe(stop.name)+'</button>' : '<strong>'+safe(stop.name)+'</strong>')+
      (settings.market==='zh' && stop.cn ? '<span lang="zh-Hans" class="lang-line">'+safe(stop.cn)+'</span>':'')+
      '<span class="caption">'+(stop.type==='travel'?'Переезд · расчётное время':kindNames[stop.type]+
        (stop.split?' · два сеанса по '+Math.ceil(settings.size/2)+' чел.':' · лимит '+safe(stop.capacity)+' чел.'+(settings.demo?' в демо':'')))+'</span></div></li>').join('')+
    '</ul>'+(day.missing.length?'<p class="callout">Требуется подтверждение: '+safe(day.missing.join(', '))+'.</p>':'')+'</section>';
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
      (review.aiLoading?' readonly':'')+'>'+safe(review.brief)+'</textarea></label>'+
      '<button type="submit" class="button-quiet"'+(review.aiLoading||review.dirty?' disabled':'')+'>'+
      (review.aiLoading?'Сравниваем…':'Сравнить варианты с ИИ')+'</button></form>' :
      '<p class="caption route-ai-empty">Для сравнения нужны два варианта, прошедших проверку.</p>')+
    (review.aiLoading ? '<p class="caption status-line" role="status">Готовим подсказку…</p>' : '')+
    (analysis ? '<div class="route-ai-result" aria-live="polite"><p class="'+(analysis.status==='live'?'caption':'callout')+'">'+safe(analysis.message)+'</p>'+
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

function routeDecision(plan) {
  const variant = selectedVariant();
  const approved = approvedVariant(variant);
  const approvalVisible = !review.loading && variant?.signature && variant.plan.completeness;
  const localized = plan.settings.market==='zh';
  const assumptions = plan.assumptions?.length ? plan.assumptions : plan.days.some(day=>day.stops.some(stop=>stop.split))
    ? ['Согласуйте два отдельных сеанса с музеем.'] : [];
  return '<section class="panel route-program" aria-labelledby="route-program-title"><div class="section-head"><div>'+
    '<h2 id="route-program-title" tabindex="-1">'+safe(plan.days.map(day=>day.city).join(' → '))+'</h2>'+
    '<p class="caption">'+date(plan.settings.date)+' · '+plan.settings.days+' дня · '+plan.settings.size+' чел.'+
    (localized?' · Группа из Китая':'')+'</p></div>'+routeState(plan)+'</div>'+
    chinesePreview(plan)+
    (plan.themeNote ? '<p class="callout">'+safe(plan.themeNote)+'</p>' : '')+
    '<div class="route-days">'+plan.days.map((day,i)=>renderDay(day,i,plan.settings)).join('')+'</div>'+
    (assumptions.length ? '<div class="callout">'+assumptions.map(note=>'<p>'+safe(note)+'</p>').join('')+'</div>' : '')+
    (approvalVisible ? '<div class="route-approval"><div><h3>'+(approved?'Решение сохранено':'Решение специалиста')+'</h3><p class="caption">'+
      (plan.settings.demo?'Согласование в рамках пилота. Подтверждение визитов остаётся за поставщиками.':
        'Согласование записывает эту версию программы в журнал. Подтвердите бронирование у поставщиков.')+
      '</p></div>'+(approved ? chip('Согласовано') :
        '<button type="button" class="button" data-action="approve-route"'+(review.dirty?' disabled':'')+'>Согласовать вариант</button>')+'</div>' : '')+'</section>';
}

function officialRouteReview(plan) {
  const {settings} = plan;
  const itinerary = plan.days.map((day,index)=>{
    const candidates = data.places.flatMap(place=>{
      const lunch = index===2 && place.city==='Суздаль' && place.kind==='food';
      const relevant = place.city===day.city && (place.kind==='visit' || index!==2 && place.kind==='food' ||
        index<settings.days-1 && place.kind==='stay');
      if (!lunch && !relevant) return [];
      const result = assess(place,settings,index);
      return [{place,result,hours:publishedHours(place,settings.date,index)}];
    });
    const unresolved = candidates.filter(item=>item.result.status!=='ready').length;
    const rows = candidates.map(({place,result,hours})=>
      '<li><div><button type="button" class="link-button" data-place="'+safe(place.id)+'" data-place-day="'+index+'">'+safe(place.name)+'</button>'+
      '<p class="caption">'+safe(kindNames[place.kind])+' · '+safe(openingLabel(hours))+'</p>'+
      (result.reasons.length ? '<p class="detail">'+safe(result.reasons[0])+'</p>' : '')+'</div>'+
      chip(statusText[result.status],result.status==='blocked'?'error':result.status==='unknown'?'warn':'')+'</li>').join('');
    return '<details'+(index===0?' open':'')+'><summary><span>День '+(index+1)+' · '+safe(day.city)+'<small>'+date(day.date)+'</small></span>'+
      '<span class="caption">Требуют внимания '+unresolved+' из '+candidates.length+'</span></summary>'+
      (rows ? '<ul class="rows official-route-rows">'+rows+'</ul>' : '<p class="detail">В каталоге пока нет объектов для этого дня.</p>')+'</details>';
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

function routeWorkbench() {
  const plan = currentRoutePlan();
  return routeVariants()+'<div class="route-review">'+routeAssistant()+routeDecision(plan)+'</div>'+
    (plan.settings.demo ? '' : officialRouteReview(plan))+decisionJournal();
}

function currentRoutePlan() {
  return selectedVariant()?.plan ?? review.preview ?? planRoute(data.places,options);
}

function routeView() {
  return head('Планирование маршрута','Владимирская область · программы на два или три дня')+
    '<div class="route-layout"><form id="route-form" class="panel route-options"><h2>Параметры</h2>'+
    '<label class="field">Дата начала<input name="date" type="date" required value="'+safe(options.date)+'"></label>'+
    '<label class="field">Длительность<select name="days">'+selectOption(2,'2 дня',options.days)+selectOption(3,'3 дня',options.days)+'</select></label>'+
    '<label class="field">Размер группы<input name="size" type="number" min="1" max="100" required value="'+options.size+'"></label>'+
    '<label class="field">Группа<select name="market">'+selectOption('zh','Группа из Китая',options.market)+selectOption('ru','Российская группа',options.market)+'</select></label>'+
    '<label class="field">Формат поездки<select name="theme">'+Object.entries(routeThemes).map(([value,label])=>selectOption(value,label,options.theme)).join('')+'</select></label>'+
    '<label class="check"><input type="checkbox" name="access" '+(options.access?'checked':'')+'>Безбарьерный доступ</label>'+
    '<label class="check"><input type="checkbox" name="demo" '+(options.demo?'checked':'')+'>Учебные условия визита</label>'+
    '<button type="submit" class="button">Рассчитать варианты</button>'+
    '<p class="caption route-dirty" role="status"'+(review.dirty?'':' hidden')+'>Пересчитайте варианты с новыми параметрами.</p></form>'+
    '<div class="route-workbench" id="route-workbench">'+routeWorkbench()+'</div></div>';
}

function repaintWorkbench() {
  const workspace = $('#route-workbench');
  if (!workspace) return;
  const chineseOpen = workspace.querySelector('.chinese-preview')?.open;
  workspace.innerHTML = routeWorkbench();
  const preview = workspace.querySelector('.chinese-preview');
  if (preview && chineseOpen) preview.open = true;
}

function downloadChinese(decisionId) {
  if (!decisionId && (review.dirty || review.loading)) return;
  const plan = decisionId ? data.decisions?.find(item=>item.id===decisionId)?.plan : currentRoutePlan();
  if (!plan) return;
  const itinerary = chineseItinerary(plan);
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
  requested.loading = true;
  requested.error = '';
  repaintWorkbench();
  try {
    const result = await api('alternatives',options);
    requested.variants = result.options;
    const matching = requested.preview && requested.variants.find(variant=>scheduleKey(variant.plan)===scheduleKey(requested.preview));
    requested.selectedId = (matching ?? requested.variants[0])?.id;
  } catch(error) {
    requested.error = error.message;
  } finally {
    requested.loading = false;
    if (requested===review) repaintWorkbench();
  }
}

async function requestRouteAnalysis() {
  const requested = review;
  if (requested.dirty || requested.aiLoading) return;
  requested.aiLoading = true;
  requested.analysis = null;
  repaintWorkbench();
  try {
    requested.analysis = await api('route-ai',{settings:options,brief:requested.brief,programId:requested.program?.id});
  } catch(error) {
    requested.analysis = {status:'unavailable',message:error.message,suggestions:[]};
  } finally {
    requested.aiLoading = false;
    if (requested===review) {
      repaintWorkbench();
      $('#route-ai-form button')?.focus({preventScroll:true});
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
  return '<p class="caption statistics-source">'+chip(text,status==='error'?'warn':status==='live'?'':'plain')+
    (checkedAt ? ' Проверка источника: '+timestamp(checkedAt) : '')+'</p>';
}

function agentView() {
  if (!agent) return '';
  return '<div class="ask-result" aria-live="polite"><h3>'+safe(agent.title)+'</h3><p class="detail">'+safe(agent.text)+'</p>'+
    '<p class="caption status-line">'+safe(agent.plan.mode)+'</p>'+
    (agent.summary ? '<p class="caption">'+outbound(agent.summary.source,'Ряд Roschart')+' · '+outbound(agent.summary.publication,'Первоисточник Росстат')+
      ' · '+safe(agent.summary.edition)+' · Данные получены '+timestamp(agent.summary.checkedAt)+'</p>'+
      statisticsSource(agent.sourceStatus,agent.sourceCheckedAt)+(agent.note ? '<p class="caption">'+safe(agent.note)+'</p>' : '')+
      (agent.summary.years.length?statisticChart(agent.summary):'') : '')+
    (agent.view?'<a href="#'+safe(agent.view)+'">Открыть '+(agent.view==='impact'?'мониторинг':'маршрут')+'</a>':'')+'</div>';
}

function stats() {
  const series = data[metric];
  return head('Сезонность размещения','Владимирская область · месячные ряды Росстата',button('Обновить источники','refresh',true))+
    '<div class="grid"><section class="panel"><div class="section-head"><div><h2>'+safe(series.name)+'</h2><p class="caption">Средние по полным календарным годам</p></div>'+
    '<label class="field">Показатель<select id="metric">'+selectOption('nights','Ночёвки',metric)+selectOption('people','Размещённые лица',metric)+'</select></label></div>'+
    statisticChart(series)+'<p class="caption status-line">'+outbound(series.publication,'Росстат')+' · '+outbound(series.source,'Выгрузка через Roschart')+
    ' · '+safe(series.edition)+' · '+timestamp(series.checkedAt)+'</p>'+statisticsSource(data.sources[metric]?.status,data.sources[metric]?.checkedAt)+'</section>'+
    '<section class="panel"><h2>Запросить анализ</h2><form id="ask-form" class="ask"><input aria-label="Запрос к агенту" type="text" name="question" required maxlength="600" placeholder="Например, когда меньше ночёвок?"><button type="submit" class="button">Спросить</button></form>'+
    '<button class="link-button sample" data-sample="В какие месяцы меньше всего ночёвок за последние три полных года?">Минимум ночёвок за три года</button><br>'+
    '<button class="link-button sample" data-sample="Какие маршруты затронуло изменение лимита?">Какие маршруты затронуты</button>'+agentView()+'</section></div>';
}

function offerPanel() {
  const {date:arrival,occupancy,result} = offerSearch;
  const places = new Map(data.places.map(place=>[place.id,place.name]));
  const providers = new Map(result?.providers.map(provider=>[provider.id,provider.name]));
  return '<section class="panel ota-panel"><div class="section-head"><h2>Предложения размещения</h2>'+chip('Учебные данные','warn')+'</div>'+
    '<p class="detail">Сопоставляем две учебные выгрузки OTA по дате заезда. Для группы свободные номера и условия нужно подтвердить у отеля.</p>'+
    '<form class="filters ota-form" id="ota-form"><label class="field">Дата заезда<input type="date" name="arrival" required value="'+safe(arrival)+'"></label>'+
    '<label class="field">Гостей в номере<select name="occupancy">'+selectOption(1,'1 гость',occupancy)+selectOption(2,'2 гостя',occupancy)+
    '</select></label><button type="submit" class="button-quiet">Сравнить предложения</button></form>'+
    (result ? '<div aria-live="polite">'+(result.coverage==='snapshot' ? '<ul class="rows">'+result.objects.map(stay=>'<li><h3>'+safe(places.get(stay.id)??stay.id)+'</h3>'+
      stay.offers.map(offer=>'<p class="detail">'+safe(providers.get(offer.providerId))+' · '+number(offer.priceRub)+' ₽ за ночь · '+number(offer.roomsListed)+
        ' ном. в выгрузке</p>').join('')+'</li>').join('')+'</ul>' : '<p class="callout">На эту дату и состав номера в учебных выгрузках нет данных.</p>')+
      '<p class="caption">'+result.providers.map(provider=>safe(provider.name)+' · '+safe(provider.version)+' · '+timestamp(provider.checkedAt)).join('<br>')+'</p></div>' :
      '<p class="caption">Выгрузки покрывают сценарий 21–22 ноября 2026 года.</p>')+
    '<p class="caption ota-source">'+outbound('/api/demo-offers-source','Открыть учебные выгрузки')+' · Данные об отелях учитываются по объектам каталога.</p></section>';
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
  const feed = data.auditFeed;
  const published = data.publishedConditions;
  const feedLabel = {live:'Подключена', error:'Ошибка обновления', pending:'Ожидает проверки'};
  return head('Источники и изменения','Автоматическая проверка при запуске и раз в 6 часов работы приложения.',button('Обновить источники','refresh',true))+
    '<div class="grid"><section class="panel"><div class="section-head"><h2>Журнал изменений</h2></div>'+
    (data.changes.length ? '<ul class="rows">'+data.changes.map(change=>'<li><div class="row"><div><h3>'+safe(change.name)+'</h3><p class="detail">'+
      safe(change.field)+' · '+safe(val(change.before))+' → '+safe(val(change.after))+'</p><p class="caption">'+outbound(change.url,change.source)+
      ' · '+timestamp(change.at)+'</p></div>'+(change.demo ? chip('Учебное изменение','warn') : chip('Из внешнего источника'))+'</div></li>').join('')+
      '</ul>' : '<p class="empty">Изменений не зафиксировано.</p>')+'</section>'+
    '<div class="stack"><section class="panel"><div class="section-head"><h2>Автоматические подключения</h2></div><ul class="rows">'+sourceRows.join('')+
    (feed ? '<li><div class="row"><div><h3>Выгрузка условий визита</h3><p class="caption">'+
      (feed.enabled && feed.snapshotAt ? 'Снимок от '+timestamp(feed.snapshotAt)+' · объектов: '+number(feed.objectCount ?? 0) :
        (feed.enabled?'Ожидаем доступный снимок с подтверждёнными условиями.':'Нет подключённой выгрузки с подтверждёнными условиями.'))+
      '</p></div>'+chip(feed.enabled ? feedLabel[feed.state] : 'Не подключена',feed.state==='live'?'':feed.state==='error'?'warn':'plain')+'</div></li>' : '')+
    '</ul></section>'+
    '<section class="panel"><div class="section-head"><h2>Справочные материалы</h2></div><ul class="rows">'+
    (published?.objectCount ? '<li><h3>Опубликованные условия посещения</h3><p class="detail">Сверены сведения по '+number(published.objectCount)+
      ' объектам · '+date(published.checkedAt)+'. Снимок собран по страницам музеев, поставщиков и регионального турпортала.</p>'+
      '<p class="caption">Ссылки, область действия лимитов и вопросы к поставщику доступны в <a href="#catalog">каталоге объектов</a>.</p></li>' : '')+
    '<li><h3>'+outbound('/api/audit-version/'+data.auditVersion,'Учебный аудит · версия '+data.auditVersion)+'</h3><p class="caption">Сценарные лимиты, режим работы и условия для групп.</p></li>'+
    '<li><h3>Материалы МАГ</h3><p class="caption">Диагностические критерии и контрольные объекты использованы для сверки. Первичные материалы доступны участникам кейса на доске.</p></li></ul></section></div></div>'+offerPanel();
}

function render(scroll=false) {
  if (!data) return;
  const current = page();
  document.title = labels[current]+' — ТурКонтур';
  document.querySelectorAll('nav a').forEach(a=>{
    if (a.hash==='#'+current) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  document.body.classList.toggle('atlas-page',current==='impact');
  if (current==='impact') {
    if (atlas) atlas.update(data);
    else atlas=mountAtlas(screen,data,geodata,{
      onOpenRoute(settings,program,context) {
        options=settings;
        review=newReview(program,context);
        location.hash='route';
      },
      onOpenPlace(id,settings,offset) { placeDetails(id,null,offset,settings); },
    });
  } else {
    if (atlas) { atlas.destroy(); atlas=null; }
    screen.innerHTML = {catalog,route:routeView,stats,sources}[current]();
    if (current==='route' && !review.variants && !review.loading && !review.error) void loadAlternatives();
  }
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
    render();
    $('#route-form button')?.focus({preventScroll:true});
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
  if (target.dataset.place) placeDetails(target.dataset.place,target.dataset.decision,Number(target.dataset.placeDay));
  if (target.dataset.action==='select-variant') {
    if (busy) return;
    review.selectedId = target.dataset.variant;
    const fromAi = target.closest('.route-assistant')!==null;
    repaintWorkbench();
    const selector = fromAi ? '.route-ai-suggestions [aria-pressed=true]' : '.route-variant[aria-pressed=true]';
    $(selector)?.focus({preventScroll:true});
  }
  if (target.dataset.action==='retry-variants') void loadAlternatives();
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
    toast(data.auditVersion==='2'?'Лимит обновлён. Программы пересчитаны.':'Восстановлены исходные учебные условия.');
    render();
  },target);
});

screen.addEventListener('input',event=>{
  if (event.target.id==='search') {
    filters.search = event.target.value;
    $('#catalog-rows').innerHTML = catalogRows();
  }
  if (event.target.form?.id==='route-form') {
    review.dirty = !sameSettings(readOptions(event.target.form),options);
    $('.route-dirty').hidden = !review.dirty;
    const approve = $('[data-action="approve-route"]');
    if (approve) approve.disabled = review.dirty || busy;
    const compare = $('#route-ai-form button');
    if (compare) compare.disabled = review.dirty || review.aiLoading;
    const download = $('.chinese-preview [data-action="download-chinese"]');
    if (download) download.disabled = review.dirty || review.loading;
  }
  if (event.target.form?.id==='route-ai-form') review.brief = event.target.value;
});
screen.addEventListener('change',event=>{
  const input = event.target;
  if (input.id==='catalog-date') {
    filters.date = input.value ? routeSettings({date:input.value}).date : '';
    input.value = catalogSettings().date;
    $('#catalog-rows').innerHTML = catalogRows();
  }
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
  [data, geodata] = await Promise.all([api('state'), api('map').catch(()=>({}))]);
  render();
  if (!data.refreshedAt) setTimeout(async()=>{
    if (!busy && !dialog.open && !screen.contains(document.activeElement)) {
      try { data = await api('state'); render(); } catch { /* last rendered state remains usable */ }
    }
  },8000);
} catch(error) {
  screen.innerHTML = '<p role="alert">'+safe(error.message)+'</p>';
} finally { screen.setAttribute('aria-busy','false'); }
