import { addLocaleMessages, formatDate, formatNumber, t } from '/locale.js';

addLocaleMessages([
  ['Мониторинг программ · Владимирская область','Itinerary monitoring · Vladimir Oblast','行程监测 · 弗拉基米尔州'],
  ['Программы на контроле','Monitored itineraries','监测中的行程'],
  ['Требуют пересмотра','Need revision','需要复核'],
  ['Условия опубликованы','Published conditions','已公布参观条件'],
  ['Объектов с опубликованными условиями','Places with published conditions','已公布条件的地点'],
  ['Условия подтверждены поставщиком','Supplier-confirmed conditions','供应方已确认的条件'],
  ['Проверка источников','Source check','数据源检查'],
  ['Обновление ожидается','Awaiting a refresh','等待更新'],
  ['Собрать маршрут','Build an itinerary','编制行程'],
  ['Маршрут по России','Itinerary across Russia','俄罗斯全境行程'],
  ['Открыть карту','Open map','打开地图'],
  ['Изменения','Changes','变更'],
  ['Влияют на программы','Affect itineraries','影响行程'],
  ['Все события','All activity','所有变更'],
  ['Подтверждённые источники','Verified sources','已核验的数据源'],
  ['Просмотр изменения','Change details','变更详情'],
  ['Название в Wikidata расходится с каталогом. Сверьте идентичность объекта.','The Wikidata name differs from the catalogue. Check the place identity.','维基数据中的名称与名录不一致，请核实地点身份。'],
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
const changeId = change=>JSON.stringify([change.at,change.id ?? change.name,change.key,change.field,change.url]);
const action = (label, href, kind='button-quiet')=>'<a class="'+kind+'" href="'+html(href)+'">'+local(label)+'</a>';
const linkTo = (page,params) => '#'+page+'?'+new URLSearchParams(params);

function programLink(record, place) {
  return linkTo('impact',{program:record.id,...(place ? {place} : {})});
}

function recordList(records) {
  return '<ul class="ops-programmes">'+records.map(record=>`
    <li><div><h3>${html(record.title)}</h3>
      <p class="caption">${html(t(record.subtitle))} · ${html(shortdate(record.settings.date))} · ${formatNumber(record.settings.size)}</p></div>
      <div class="ops-program-actions">
        <span class="chip ${record.affected?'warn':'plain'}">${local(record.affected?'Требуют пересмотра':'По текущим условиям без замечаний')}</span>
        <a href="${html(programLink(record))}">${local('Проверить программу')} <span aria-hidden="true">↗</span></a>
      </div></li>`).join('')+'</ul>';
}

export function renderMonitoredProgrammes(data, view, cityId) {
  const programmes = data.affected ?? [];
  const scope = programmes.filter(record=>!record.settings.demo);
  const training = programmes.filter(record=>record.settings.demo);
  const awaiting = scope.filter(record=>record.affected).length;
  const timeline = (data.changes ?? []).map(change=>({change,id:changeId(change),
    programmes:programmes.filter(record=>change.affectedProgramIds?.includes(record.id))}));
  const visible = timeline.filter(entry=>view.filter==='impact' ? entry.programmes.length : view.filter==='external' ? !entry.change.demo : true);
  const entry = visible.find(item=>item.id===view.selected) ?? visible.find(item=>item.programmes.length) ?? visible[0];
  const sortOrder = visible.slice().sort((left,right)=>Number(Boolean(right.programmes.length))-Number(Boolean(left.programmes.length)));
  const publishedCount = data.publishedConditions?.objectCount ?? 0;
  const verifiedCount = data.auditFeed?.objectCount ?? 0;
  const comparisonLink = linkTo('impact',{analysis:'1',...(cityId ? {city:cityId} : {})});
  return `
    <header class="ops-head"><h2>${local('Мониторинг программ · Владимирская область')}</h2>
      ${action('Сравнить улучшения',comparisonLink,'button')}</header>
    <div class="ops-board">
      <section class="panel ops-log" aria-labelledby="ops-changes">
        <header class="section-head"><h2 id="ops-changes">${local('Изменения')}</h2><a href="#sources">${local('Журнал источников')}</a></header>
        <p class="caption ops-source-check">${data.refreshedAt ? local('Проверка источников')+' · <time datetime="'+html(data.refreshedAt)+'">'+html(timestamp(data.refreshedAt))+'</time>' : local('Обновление ожидается')}</p>
        <div class="ops-filters" role="group" aria-label="${local('Изменения')}">${[['all','Все события'],['impact','Влияют на программы'],['external','Из внешнего источника']]
          .map(([key,label])=>'<button type="button" aria-controls="ops-change-list" aria-pressed="'+(view.filter===key)+'" data-action="overview-filter" data-value="'+key+'">'+local(label)+'</button>').join('')}</div>
        <div id="ops-change-list" class="ops-change-list">${sortOrder.length ? sortOrder.slice(0,12).map(item=>`
          <button type="button" class="ops-change" data-action="overview-change" data-value="${html(item.id)}" aria-controls="ops-change-detail" aria-pressed="${item.id===entry?.id}">
            <span class="ops-change-dot ${item.programmes.length?'ops-change-dot--active':''}" aria-hidden="true"></span>
            <span><strong>${html(item.change.name)}</strong><small>${html(t(item.change.field))} · ${html(rooms(item.change.before))} → ${html(rooms(item.change.after))}</small>${item.programmes.length?'<small>'+local('Программ затронуто сейчас: {count}',{count:formatNumber(item.programmes.length)})+'</small>':''}</span>
            <time datetime="${html(item.change.at)}">${html(timestamp(item.change.at))}</time>
          </button>`).join('') : '<p class="ops-empty">'+local('В этом разделе пока нет изменений.')+'</p>'}
        </div>
      </section>
      ${entry ? `<section class="panel ops-readout" id="ops-change-detail" aria-labelledby="ops-selected">
          <h2 id="ops-selected">${html(entry.change.name)}</h2>
          <div class="ops-signal"><span>${html(t(entry.change.field))}</span><strong>${html(rooms(entry.change.before))} <span aria-hidden="true">→</span> ${html(rooms(entry.change.after))}</strong></div>
          <p class="caption"><a href="${html(entry.change.url)}" target="_blank" rel="noopener noreferrer">${html(entry.change.source)}</a> · ${html(timestamp(entry.change.at))}</p>
          <p class="ops-source-kind"><span class="chip ${entry.change.demo?'warn':'plain'}">${local(entry.change.demo?'Учебное изменение':'Из внешнего источника')}</span></p>
          ${entry.change.key==='wikiName' && entry.programmes.length ? '<p class="detail">'+local('Название в Wikidata расходится с каталогом. Сверьте идентичность объекта.')+'</p>' : ''}
          <h3>${local('Программ затронуто сейчас: {count}',{count:formatNumber(entry.programmes.length)})}</h3>
          ${entry.programmes.length ? '<ul class="ops-linked">'+entry.programmes.map(record=>`
            <li><strong>${html(record.title)}</strong><small>${html(t(record.subtitle))} · ${html(shortdate(record.settings.date))} · ${formatNumber(record.settings.size)}${record.settings.demo?' · '+local('Учебная программа'):''}</small>
              ${action('Сравнить варианты',programLink(record,entry.change.id))}</li>`).join('')+'</ul>' :
            data.places.some(place=>place.id===entry.change.id) ? action('Открыть на карте',linkTo('impact',{place:entry.change.id,layer:entry.change.demo?'route':'official'})) : ''}
      </section>` : ''}
      <section class="panel ops-monitor" id="ops-programmes" tabindex="-1" aria-labelledby="ops-monitor">
        <header class="section-head"><h2 id="ops-monitor">${local('Программы на контроле')}</h2></header>
        ${scope.length ? (awaiting ? '<p class="caption ops-monitor-count">'+local('Требуют пересмотра')+' · '+formatNumber(awaiting)+'</p>' : '')+recordList(scope) : '<p class="ops-empty">'+local('Нет программ на контроле.')+'</p>'}
        ${training.length ? '<details class="ops-training" '+(training.some(record=>record.affected)?'open':'')+'><summary>'+local('Учебные программы')+' · '+formatNumber(training.length)+'</summary>'+recordList(training)+'</details>':''}
      </section>
    </div>
    <div class="ops-conditions">
      <a href="#catalog">${local('Объектов с опубликованными условиями')} · <strong>${formatNumber(publishedCount)} ${local('из {total}',{total:formatNumber(data.places.length)})}</strong></a>
      <span>${local('Условия подтверждены поставщиком')} · ${formatNumber(verifiedCount)}</span>
    </div>`;
}
