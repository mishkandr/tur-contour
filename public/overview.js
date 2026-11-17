import { addLocaleMessages, formatDate, formatNumber, t } from '/locale.js';

addLocaleMessages([
  ['Обзор региона','Regional overview','地区概览'],
  ['На контроле','Under review','监测中的行程'],
  ['Требуют пересмотра','Need revision','需要复核'],
  ['Условия опубликованы','Published conditions','已公布参观条件'],
  ['Объектов с опубликованными условиями','Places with published conditions','已公布条件的地点'],
  ['Условия подтверждены поставщиком','Supplier-confirmed conditions','供应方已确认的条件'],
  ['Проверка источников','Source check','数据源检查'],
  ['Собрать маршрут','Build an itinerary','编制行程'],
  ['Открыть карту','Open map','打开地图'],
  ['Изменения','Changes','变更'],
  ['Влияют на программы','Affect itineraries','影响行程'],
  ['Все события','All activity','所有变更'],
  ['Подтверждённые источники','Verified sources','已核验的数据源'],
  ['Просмотр изменения','Change details','变更详情'],
  ['Программ затронуто сейчас: {count}','Itineraries currently affected: {count}','目前受影响的行程：{count}'],
  ['Открыть на карте','Show on map','在地图上查看'],
  ['Сравнить варианты','Compare options','比较方案'],
  ['Условия программы','Itinerary conditions','行程条件'],
  ['Открыть паспорт','Open place record','查看地点档案'],
  ['Журнал источников','Source log','数据源记录'],
  ['В этом разделе пока нет изменений.','There are no changes in this view yet.','此视图暂无变更。'],
  ['По текущим условиям без замечаний','No issues under current conditions','按当前条件无异常'],
  ['Учебная программа','Training itinerary','演示行程'],
  ['Учебные программы','Training itineraries','演示行程'],
  ['Программы в работе','Working itineraries','工作行程'],
  ['Проверить программу','Check itinerary','核查行程'],
  ['Нет программ на контроле.','No itineraries are being monitored.','暂无监测中的行程。'],
  ['Нет расчёта','No calculation','暂无测算'],
  ['из {total}','of {total}','共 {total}'],
  ['Данные Владимирской области','Vladimir Oblast data','弗拉基米尔州数据'],
  ['Дата · группа · режим проверки','Date · group · evidence mode','日期 · 团队 · 核查模式'],
  ['Ответить на вопрос по данным','Ask a question about the data','询问数据'],
  ['ИИ · статистика','AI · statistics','人工智能 · 统计'],
]);

const html = value => String(value ?? '').replace(/[&<>"']/g,
  char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const local = (label,params) => html(t(label,params));
const rooms = value=>typeof value==='number' ? formatNumber(value) :
  Array.isArray(value) ? value.join(', ') : (value ?? t('Нет данных'));
const timestamp = value=>value ? formatDate(value,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : t('Нет данных');
const shortdate = value=>formatDate(value,{day:'numeric',month:'short',year:'numeric'});
const changeId = change=>[change.at,change.id,change.key].join('|');
const action = (label, href, kind='button-quiet')=>'<a class="'+kind+'" href="'+html(href)+'">'+local(label)+' <span aria-hidden="true">↗</span></a>';
const linkTo = (page,params) => '#'+page+'?'+new URLSearchParams(params);

function related(change, programmes) {
  return programmes.filter(record=>record.affected && Boolean(record.settings.demo)===Boolean(change.demo) &&
    record.issues?.some(issue=>issue.id===change.id));
}

function programLink(record, place) {
  return linkTo('impact',{program:record.id,...(place ? {place} : {})});
}

function recordList(records) {
  if (!records.length) return '<p class="empty">'+local('Нет программ на контроле.')+'</p>';
  return '<ul class="ops-programmes">'+records.map(record=>`
    <li><div><h3>${html(record.title)}</h3>
      <p class="caption">${html(t(record.subtitle))} · ${html(shortdate(record.settings.date))} · ${formatNumber(record.settings.size)}</p></div>
      <div class="ops-program-actions">
        <span class="chip ${record.affected?'warn':'plain'}">${local(record.affected?'Требуют пересмотра':'По текущим условиям без замечаний')}</span>
        <a href="${html(programLink(record))}">${local('Проверить программу')} <span aria-hidden="true">↗</span></a>
      </div></li>`).join('')+'</ul>';
}

export function renderOverview(data, view) {
  const programmes = data.affected ?? [];
  const awaiting = programmes.filter(record=>record.affected).length;
  const timeline = (data.changes ?? []).map(change=>({change,id:changeId(change),programmes:related(change,programmes)}));
  const visible = timeline.filter(entry=>view.filter==='impact' ? entry.programmes.length : view.filter==='external' ? !entry.change.demo : true);
  const entry = visible.find(item=>item.id===view.selected) ?? visible.find(item=>item.programmes.length) ?? visible[0];
  const sortOrder = visible.slice().sort((left,right)=>Number(Boolean(right.programmes.length))-Number(Boolean(left.programmes.length)));
  const publishedCount = data.publishedConditions?.objectCount ?? 0;
  const verifiedCount = data.auditFeed?.objectCount ?? 0;
  const scope = programmes.filter(record=>!record.settings.demo);
  const training = programmes.filter(record=>record.settings.demo);
  return `
    <header class="ops-head">
      <div><p class="ops-kicker">${local('Владимирская область')}</p><h1>${local('Обзор региона')}</h1></div>
      <div class="actions ops-head-actions">${action('Открыть карту','#impact')}${action('Собрать маршрут','#route','button')}</div>
    </header>
    <div class="ops-metrics" aria-label="${local('Данные Владимирской области')}">
      <a href="#overview?focus=programmes"><span>${local('На контроле')}</span><strong>${formatNumber(programmes.length)}</strong><small>${local('Требуют пересмотра')} · ${formatNumber(awaiting)}</small></a>
      <a href="#catalog"><span>${local('Условия опубликованы')}</span><strong>${formatNumber(publishedCount)} <small>${local('из {total}',{total:formatNumber(data.places.length)})}</small></strong><small>${local('Условия подтверждены поставщиком')} · ${formatNumber(verifiedCount)}</small></a>
      <a href="#sources"><span>${local('Проверка источников')}</span><strong class="ops-check">${html(timestamp(data.refreshedAt))}</strong><small>${local('Журнал источников')} <span aria-hidden="true">↗</span></small></a>
    </div>
    <div class="ops-board">
      <section class="panel ops-log" aria-labelledby="ops-changes">
        <header class="section-head"><h2 id="ops-changes">${local('Изменения')}</h2><a href="#sources">${local('Журнал источников')} <span aria-hidden="true">↗</span></a></header>
        <div class="ops-filters" role="group" aria-label="${local('Изменения')}">${[['all','Все события'],['impact','Влияют на программы'],['external','Из внешнего источника']]
          .map(([key,label])=>'<button type="button" aria-pressed="'+(view.filter===key)+'" data-action="overview-filter" data-value="'+key+'">'+local(label)+'</button>').join('')}</div>
        <div class="ops-change-list">${sortOrder.length ? sortOrder.slice(0,12).map(item=>`
          <button type="button" class="ops-change" data-action="overview-change" data-value="${html(item.id)}" aria-pressed="${item.id===entry?.id}">
            <span class="ops-change-dot ${item.programmes.length?'ops-change-dot--active':''}" aria-hidden="true"></span>
            <span><strong>${html(item.change.name)}</strong><small>${html(t(item.change.field))} · ${html(rooms(item.change.before))} → ${html(rooms(item.change.after))}</small></span>
            <time datetime="${html(item.change.at)}">${html(timestamp(item.change.at))}</time>
          </button>`).join('') : '<p class="empty">'+local('В этом разделе пока нет изменений.')+'</p>'}
        </div>
      </section>
      <section class="panel ops-readout" aria-labelledby="ops-selected">
        ${entry ? `
          <span class="ops-kicker">${local('Просмотр изменения')}</span><h2 id="ops-selected">${html(entry.change.name)}</h2>
          <div class="ops-signal"><span>${html(t(entry.change.field))}</span><strong>${html(rooms(entry.change.before))} <span aria-hidden="true">→</span> ${html(rooms(entry.change.after))}</strong></div>
          <p class="caption"><a href="${html(entry.change.url)}" target="_blank" rel="noopener noreferrer">${html(entry.change.source)}</a> · ${html(timestamp(entry.change.at))}</p>
          <p class="ops-source-kind"><span class="chip ${entry.change.demo?'warn':'plain'}">${local(entry.change.demo?'Учебное изменение':'Из внешнего источника')}</span></p>
          <h3>${local('Программ затронуто сейчас: {count}',{count:formatNumber(entry.programmes.length)})}</h3>
          ${entry.programmes.length ? '<ul class="ops-linked">'+entry.programmes.map(record=>`
            <li><strong>${html(record.title)}</strong><small>${html(t(record.subtitle))} · ${html(shortdate(record.settings.date))} · ${formatNumber(record.settings.size)}</small>
              ${action('Сравнить варианты',programLink(record,entry.change.id))}</li>`).join('')+'</ul>' :
            data.places.some(place=>place.id===entry.change.id) ? action('Открыть на карте',linkTo('impact',{place:entry.change.id,layer:entry.change.demo?'route':'official'})) : ''}
        ` : `<span class="ops-kicker">${local('ИИ · статистика')}</span><h2 id="ops-selected">${local('Ответить на вопрос по данным')}</h2>
          ${action('Вопрос по данным','#ask')}`}
      </section>
    </div>
    <section class="panel ops-monitor" id="ops-programmes" tabindex="-1" aria-labelledby="ops-monitor">
      <header class="section-head"><div><h2 id="ops-monitor">${local('На контроле')}</h2><p class="caption">${local('Дата · группа · режим проверки')}</p></div>
        ${action('Собрать маршрут','#route')}</header>
      ${scope.length ? '<h3 class="ops-subheading">'+local('Программы в работе')+'</h3>'+recordList(scope):''}
      ${training.length ? '<details class="ops-training" '+(training.some(record=>record.affected)?'open':'')+'><summary>'+local('Учебные программы')+' · '+formatNumber(training.length)+'</summary>'+recordList(training)+'</details>':''}
      ${!training.length&&!scope.length ? recordList([]):''}
    </section>`;
}
